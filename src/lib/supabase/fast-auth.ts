import { createClient } from './server'
import { cookies } from 'next/headers'
import { signCookieValue, verifyAndParseCookieValue } from './cookie-signing'

interface CachedProfile {
  id: string
  email: string
  tenant_id: string
  role: string
  exp: number
}

// Keep the cache short because it contains authorization context (role and
// tenant_id). Authentication is revalidated on every call via getUser(), and a
// one-minute ceiling limits stale access after a role revocation or tenant move.
const CACHE_TTL_SECONDS = 60
const CACHE_TTL = CACHE_TTL_SECONDS * 1000

/**
 * Fast authentication that caches profile in an HMAC-signed cookie.
 * Reduces DB calls from 2 to 0 for cached users.
 *
 * P0-secu: the cookie value is HMAC-signed (see cookie-signing.ts) so a user
 * cannot edit their role/tenant_id via DevTools and trick the middleware into
 * letting them through.
 */
export async function getFastUser(): Promise<CachedProfile | null> {
  const cookieStore = await cookies()
  const cachedProfile = cookieStore.get('_profile_cache')

  // P0-secu: MUST use getUser() (validates the JWT against the Auth server), NOT
  // getSession(). API routes are excluded from the middleware matcher, so the
  // token is never network-verified upstream for them. getSession() only reads the
  // cookie and does NOT check the JWT signature — a forged @supabase/ssr cookie
  // carrying a victim's user.id would pass, and getFastUser would then return that
  // victim's tenant_id/role from the DB query below (cross-tenant + role escalation).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if we have a valid cached profile that matches the current user
  if (cachedProfile?.value && user) {
    const profile = verifyAndParseCookieValue<CachedProfile>(cachedProfile.value)
    if (profile && profile.exp > Date.now() && profile.id === user.id) {
      return profile
    }
  }

  if (!user) {
    return null
  }

  // Get profile with tenant_active check in single query
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, email, tenant_id, role, tenant:tenants!tenant_id(is_active)')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileData as { id: string; email: string; tenant_id: string; role: string; tenant: any } | null

  if (!profile) {
    return null
  }

  // Check tenant is active (skip for super_admin)
  if (profile.role !== 'super_admin') {
    const tenant = profile.tenant
    const isActive = Array.isArray(tenant) ? tenant[0]?.is_active : tenant?.is_active
    if (isActive === false) {
      await supabase.auth.signOut()
      return null
    }
  }

  const cachedData: CachedProfile = {
    id: profile.id,
    email: profile.email,
    tenant_id: profile.tenant_id,
    role: profile.role,
    exp: Date.now() + CACHE_TTL
  }

  // Cache in cookie for subsequent requests — HMAC-signed to prevent tampering.
  try {
    cookieStore.set('_profile_cache', signCookieValue(cachedData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CACHE_TTL_SECONDS,
      path: '/'
    })
  } catch {
    // Can't set cookie in Server Component, that's OK
  }

  return cachedData
}

/**
 * Get tenant ID with minimal DB calls
 */
export async function getFastTenantId(): Promise<string | null> {
  const user = await getFastUser()
  if (!user) return null
  if (user.role === 'super_admin') {
    const cookieStore = await cookies()
    const activeTenant = cookieStore.get('mlc_active_tenant')?.value
    if (activeTenant) return activeTenant
  }
  return user.tenant_id
}
