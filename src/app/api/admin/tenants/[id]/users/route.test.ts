import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/auth', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { POST } from './route'
import { requireRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function adminClient() {
  const createUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'new-user' } }, error: null,
  })
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { action_link: 'https://project.supabase.co/auth/v1/verify?token=xyz' } },
    error: null,
  })
  const deleteUser = vi.fn().mockResolvedValue({ error: null })
  const upsert = vi.fn().mockResolvedValue({ error: null })
  return {
    client: {
      auth: { admin: { createUser, generateLink, deleteUser } },
      from: vi.fn(() => ({ upsert })),
    },
    createUser,
    generateLink,
    upsert,
  }
}

function call(body: Record<string, unknown>) {
  return POST(
    new NextRequest('https://example.test/api/admin/tenants/tenant-1/users', {
      method: 'POST', body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'tenant-1' }) },
  )
}

describe('POST /api/admin/tenants/[id]/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(undefined as never)
    vi.mocked(createAdminClient).mockReturnValue(adminClient().client as never)
  })

  it('creates without a password and returns an invitation link', async () => {
    const { client, createUser, generateLink } = adminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const response = await call({ email: 'client@example.test', role: 'client' })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.invite_link).toContain('https://')
    // Le chemin recommande : l'administrateur ne connait aucun mot de passe.
    expect(createUser).toHaveBeenCalledWith(expect.not.objectContaining({ password: expect.anything() }))
    expect(generateLink).toHaveBeenCalled()
  })

  it('still accepts an explicit password so the existing flow keeps working', async () => {
    const { client, createUser, generateLink } = adminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const response = await call({ email: 'ops@example.test', password: 'motdepasse1', role: 'ops' })

    expect(response.status).toBe(200)
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ password: 'motdepasse1' }))
    expect(generateLink).not.toHaveBeenCalled()
    // Meme dans ce cas, le mot de passe ne revient jamais dans la reponse.
    expect(JSON.stringify(await response.json())).not.toContain('motdepasse1')
  })

  it('rejects a password that is too short instead of creating a weak account', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await call({ email: 'a@b.test', password: 'court' })
    expect(response.status).toBe(400)
  })

  it('requires an email', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await call({ role: 'client' })
    expect(response.status).toBe(400)
  })

  it('is reserved to super_admin', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await call({ email: 'a@b.test' })
    expect(response.status).not.toBe(200)
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['super_admin'])
  })
})
