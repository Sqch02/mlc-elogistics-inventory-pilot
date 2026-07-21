import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError } from '@/lib/api/errors'

vi.mock('@/lib/supabase/auth', () => ({ requireRole: vi.fn(), requireTenant: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auto-fix/dashboard-query', () => ({ readAutoFixAuditPage: vi.fn() }))

import { GET } from './route'
import { readAutoFixAuditPage } from '@/lib/auto-fix/dashboard-query'
import { requireRole, requireTenant } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/auto-fix/dashboard/audits${query}`)
}

describe('GET /api/auto-fix/dashboard/audits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ role: 'ops' } as never)
    vi.mocked(requireTenant).mockResolvedValue('tenant-a')
    vi.mocked(createClient).mockResolvedValue({ kind: 'rls' } as never)
    vi.mocked(readAutoFixAuditPage).mockResolvedValue({
      audits: [],
      pagination: { limit: 25, nextCursor: null },
    })
  })

  it('rejects an unauthorized role before creating a database client', async () => {
    vi.mocked(requireRole).mockRejectedValue(new AuthError('Insufficient permissions', 403))

    const response = await GET(request('?cursor=2026-07-21T10%3A00%3A00.000Z'))

    expect(response.status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('uses the authenticated RLS client and explicit tenant scope', async () => {
    const response = await GET(request('?limit=25&cursor=2026-07-21T10%3A00%3A00.000Z'))

    expect(response.status).toBe(200)
    expect(requireRole).toHaveBeenCalledWith(['super_admin', 'admin', 'ops'])
    expect(readAutoFixAuditPage).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-a',
      { auditLimit: 25, auditCursor: '2026-07-21T10:00:00.000Z' },
    )
  })

  it('requires a valid cursor without touching the database', async () => {
    const response = await GET(request())

    expect(response.status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  })
})
