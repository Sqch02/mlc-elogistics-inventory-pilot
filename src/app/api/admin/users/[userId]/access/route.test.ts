import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/auth', () => ({ requireRole: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { PATCH } from './route'
import { requireRole, getCurrentUser } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

function adminClient(profile: Record<string, unknown> | null = {
  id: 'user-1', email: 'client@example.test', tenant_id: 'tenant-1', role: 'client',
}) {
  const updateUserById = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  const signOut = vi.fn().mockResolvedValue({ error: null })
  return {
    client: {
      auth: { admin: { updateUserById, signOut } },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: profile, error: profile ? null : { message: 'nope' } }),
          })),
        })),
      })),
    },
    updateUserById,
    signOut,
  }
}

function call(enabled: boolean, userId = 'user-1') {
  return PATCH(
    new NextRequest(`https://example.test/api/admin/users/${userId}/access`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
    { params: Promise.resolve({ userId }) },
  )
}

describe('PATCH /api/admin/users/[userId]/access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(undefined as never)
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1' } as never)
    vi.mocked(createAdminClient).mockReturnValue(adminClient().client as never)
  })

  it('disables the account in Supabase Auth, not only in the profile table', async () => {
    const { client, updateUserById } = adminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const response = await call(false)

    expect(response.status).toBe(200)
    // Desactiver le profil seul ne suffit pas : la session Auth resterait valide.
    expect(updateUserById).toHaveBeenCalledWith('user-1', expect.objectContaining({
      ban_duration: expect.any(String),
    }))
  })

  it('invalidates existing sessions, otherwise a disabled user stays connected', async () => {
    const { client, signOut } = adminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await call(false)

    expect(signOut).toHaveBeenCalled()
  })

  it('re-enables an account by lifting the ban', async () => {
    const { client, updateUserById, signOut } = adminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const response = await call(true)

    expect(response.status).toBe(200)
    expect(updateUserById).toHaveBeenCalledWith('user-1', { ban_duration: 'none' })
    // Rien a invalider quand on rouvre un acces.
    expect(signOut).not.toHaveBeenCalled()
  })

  it('is reserved to super_admin', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await call(false)

    expect(response.status).not.toBe(200)
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['super_admin'])
  })

  it('refuses an unknown user', async () => {
    const { client, updateUserById } = adminClient(null)
    vi.mocked(createAdminClient).mockReturnValue(client as never)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await call(false, 'ghost')

    expect(response.status).toBe(404)
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('rejects a body without an explicit boolean instead of guessing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await PATCH(
      new NextRequest('https://example.test/api/admin/users/user-1/access', {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ userId: 'user-1' }) },
    )
    expect(response.status).toBe(400)
  })

  it('traces the change', async () => {
    await call(false)
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      entityType: 'profile',
      entityId: 'user-1',
      userId: 'admin-1',
    }))
  })
})
