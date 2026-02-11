import { createClient } from './server'
import { cookies } from 'next/headers'
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
    return null
  }

  return profiles[0]
}

export async function getTenantId(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null

  // For super_admin, check if they have selected a different tenant
  if (user.role === 'super_admin') {
    const cookieStore = await cookies()
    const activeTenant = cookieStore.get('mlc_active_tenant')?.value
    if (activeTenant) {
      return activeTenant
    }
  }

  return user.tenant_id
}

export async function requireAuth(): Promise<UserProfile> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  return user
}

export async function requireTenant(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Tenant not found')
  }

  // For super_admin, check if they have selected a different tenant
  if (user.role === 'super_admin') {
    const cookieStore = await cookies()
    const activeTenant = cookieStore.get('mlc_active_tenant')?.value
    if (activeTenant) {
      return activeTenant
    }
  }

  return user.tenant_id
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
