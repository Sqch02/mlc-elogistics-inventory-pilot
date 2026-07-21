import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthError } from '@/lib/api/errors'

vi.mock('@/lib/supabase/auth', () => ({ requireRole: vi.fn(), requireTenant: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/auto-fix/dashboard-query', () => ({ readAutoFixDashboard: vi.fn() }))

import { GET } from './route'
import { readAutoFixDashboard } from '@/lib/auto-fix/dashboard-query'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, requireTenant } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

const responseFixture = {
  generatedAt: '2026-07-21T12:00:00.000Z',
  gate: { globalPaused: true, dryRunEnabled: false, tenantMode: 'off', effective: 'global_paused' },
  kpis: { totalJobs: 0, simulated: 0, pendingManual: 0, manualForecast: 0, unknown: 0, simulatedRate: 0, pendingManualRate: 0 },
  jobsByState: {}, patterns: [], patternSample: { sampledJobs: 0, totalJobs: 0, truncated: false },
  manualItems: [], audits: [], pagination: { limit: 25, nextCursor: null },
}

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/auto-fix/dashboard${query}`)
}

describe('GET /api/auto-fix/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({ role: 'ops' } as never)
    vi.mocked(requireTenant).mockResolvedValue('tenant-a')
    vi.mocked(createClient).mockResolvedValue({ kind: 'rls' } as never)
    vi.mocked(createAdminClient).mockReturnValue({ kind: 'settings' } as never)
    vi.mocked(readAutoFixDashboard).mockResolvedValue(responseFixture as never)
  })

  it('requires an internal operations role before creating database clients', async () => {
    vi.mocked(requireRole).mockRejectedValue(new AuthError('Insufficient permissions', 403))

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(requireRole).toHaveBeenCalledWith(['super_admin', 'admin', 'ops'])
    expect(createClient).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('passes the active tenant explicitly to the read model', async () => {
    const response = await GET(request('?limit=30&cursor=2026-07-20T10%3A00%3A00.000Z'))

    expect(response.status).toBe(200)
    expect(readAutoFixDashboard).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'tenant-a',
      { auditLimit: 30, auditCursor: '2026-07-20T10:00:00.000Z' },
      process.env,
    )
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('rejects an invalid cursor without instantiating service role', async () => {
    const response = await GET(request('?cursor=not-a-date'))

    expect(response.status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
