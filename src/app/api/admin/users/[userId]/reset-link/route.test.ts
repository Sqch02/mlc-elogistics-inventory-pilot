import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/auth', () => ({ requireRole: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { POST } from './route'
import { requireRole, getCurrentUser } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

function adminClient(profile: Record<string, unknown> | null = {
  id: 'user-1', email: 'client@example.test', tenant_id: 'tenant-1', role: 'client',
}) {
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { action_link: 'https://project.supabase.co/auth/v1/verify?token=abc' } },
    error: null,
  })
  return {
    client: {
      auth: { admin: { generateLink } },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: profile, error: profile ? null : { message: 'not found' } }),
          })),
        })),
      })),
    },
    generateLink,
  }
}

function call(userId = 'user-1') {
  return POST(
    new NextRequest(`https://example.test/api/admin/users/${userId}/reset-link`, { method: 'POST' }),
    { params: Promise.resolve({ userId }) },
  )
}

describe('POST /api/admin/users/[userId]/reset-link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(undefined as never)
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1' } as never)
    vi.mocked(createAdminClient).mockReturnValue(adminClient().client as never)
  })

  it('returns a recovery link without ever exposing a password', async () => {
    const response = await call()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.reset_link).toContain('https://')
    expect(body.email).toBe('client@example.test')
    // Le mot de passe ne doit apparaitre nulle part : c'est tout l'interet du lien.
    expect(JSON.stringify(body).toLowerCase()).not.toContain('password')
  })

  it('is reserved to super_admin', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await call()

    expect(response.status).not.toBe(200)
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['super_admin'])
  })

  it('refuses a user that does not exist instead of generating a link', async () => {
    const { client, generateLink } = adminClient(null)
    vi.mocked(createAdminClient).mockReturnValue(client as never)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await call('ghost')

    expect(response.status).toBe(404)
    expect(generateLink).not.toHaveBeenCalled()
  })

  it('traces the action, because handing out an account link must be auditable', async () => {
    await call()

    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      entityType: 'profile',
      entityId: 'user-1',
      tenantId: 'tenant-1',
      userId: 'admin-1',
    }))
    // Le lien lui-meme ne doit pas finir dans le journal : il vaut un mot de passe.
    const entry = vi.mocked(logAudit).mock.calls[0][0]
    expect(JSON.stringify(entry)).not.toContain('token=abc')
  })

  it('surfaces a provider failure instead of pretending it worked', async () => {
    const { client, generateLink } = adminClient()
    generateLink.mockResolvedValue({ data: null, error: { message: 'rate limited' } })
    vi.mocked(createAdminClient).mockReturnValue(client as never)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await call()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) })
  })
})
