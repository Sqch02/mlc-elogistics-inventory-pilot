import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/auth', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET } from './route'
import { requireRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const PROFILS = [
  { id: 'actif', email: 'actif@client.test', role: 'client', created_at: '2026-09-21' },
  { id: 'banni', email: 'banni@client.test', role: 'client', created_at: '2026-09-21' },
  { id: 'echu', email: 'echu@client.test', role: 'client', created_at: '2026-09-21' },
  { id: 'injoignable', email: 'injoignable@client.test', role: 'client', created_at: '2026-09-21' },
]

const BANNI_JUSQU_A: Record<string, string | undefined> = {
  actif: undefined,
  banni: '2126-09-20T06:19:37.530857Z',
  echu: '2020-01-01T00:00:00Z',
}

function adminClient() {
  const getUserById = vi.fn(async (id: string) => (
    id === 'injoignable'
      ? { data: { user: null }, error: { message: 'service unavailable' } }
      : { data: { user: { id, banned_until: BANNI_JUSQU_A[id] } }, error: null }
  ))
  const ligne = (data: unknown) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error: null }),
        then: (resoudre: (r: unknown) => unknown) => resoudre({ data, error: null }),
      })),
    })),
  })
  const from = vi.fn((table: string) => {
    if (table === 'tenants') return ligne({ id: 't1', name: 'VITALIENCE' })
    if (table === 'tenant_settings') return ligne({ tenant_id: 't1' })
    return ligne(PROFILS)
  })
  return { client: { from, auth: { admin: { getUserById } } }, getUserById }
}

describe('GET /api/admin/tenants/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue(undefined as never)
  })

  it('donne l etat d acces de chaque utilisateur, lu dans Supabase Auth', async () => {
    const { client, getUserById } = adminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const response = await GET(
      new NextRequest('https://example.test/api/admin/tenants/t1'),
      { params: Promise.resolve({ id: 't1' }) },
    )

    expect(response.status).toBe(200)
    const { users } = await response.json()
    const etat = Object.fromEntries(users.map((u: { id: string; disabled: boolean | null }) => [u.id, u.disabled]))
    expect(etat).toEqual({ actif: false, banni: true, echu: false, injoignable: null })
    expect(getUserById).toHaveBeenCalledTimes(PROFILS.length)
  })

  it('est reserve au super_admin', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await GET(
      new NextRequest('https://example.test/api/admin/tenants/t1'),
      { params: Promise.resolve({ id: 't1' }) },
    )

    expect(response.status).not.toBe(200)
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['super_admin'])
  })
})
