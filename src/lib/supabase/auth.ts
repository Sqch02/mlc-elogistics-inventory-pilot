import { createClient } from './server'
import type { UserRole } from '@/types/database'

export interface UserProfile {
  id: string
  email: string
  tenant_id: string
  role: UserRole
  full_name: string | null
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Use RPC function that bypasses RLS
  const { data, error } = await supabase.rpc('get_my_profile')
  const profiles = data as UserProfile[] | null

  if (error || !profiles || profiles.length === 0) {
    // Fallback: return basic info from auth user
    return {
      id: user.id,
      email: user.email || '',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      role: 'ops' as UserRole,
      full_name: null
    }
  }

  return profiles[0]
}

export async function getTenantId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.tenant_id ?? null
}

export async function requireAuth(): Promise<UserProfile> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  return user
}

export async function requireTenant(): Promise<string> {
  const tenantId = await getTenantId()

  if (!tenantId) {
    throw new Error('Tenant not found')
  }

  return tenantId
}

export async function requireRole(allowedRoles: UserRole[]): Promise<UserProfile> {
  const user = await requireAuth()

  if (!allowedRoles.includes(user.role)) {
    throw new Error('Insufficient permissions')
  }

  return user
}

export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'super_admin'
}
