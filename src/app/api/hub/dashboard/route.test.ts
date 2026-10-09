import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/fast-auth', () => ({ getFastUser: vi.fn() }))
vi.mock('@/lib/supabase/untyped', () => ({ getAdminDb: vi.fn() }))

import { GET } from './route'
import { getFastUser } from '@/lib/supabase/fast-auth'
import { getAdminDb } from '@/lib/supabase/untyped'

const mockGetFastUser = getFastUser as ReturnType<typeof vi.fn>
const mockGetAdminDb = getAdminDb as ReturnType<typeof vi.fn>

const superAdmin = { id: 'admin-1', role: 'super_admin', tenant_id: 'mlc' }

// Chiffres reels de Florna en octobre, releves le 09/10.
const lignesFlorna = [
  { metric: 'month', day: null, shipments_count: 3854, shipments_cost: 19242.02, shipments_missing_pricing: 361 },
  { metric: 'all_time_missing', day: null, shipments_count: 0, shipments_cost: 0, shipments_missing_pricing: 6068 },
]

function fauxClient(rpcResultat: { data: unknown; error: unknown }) {
  const tables: string[] = []
  const chaine = (resultat: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = {}
    for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'lt', 'gte', 'lte']) c[m] = vi.fn(() => c)
    c.then = (resolve: (v: unknown) => void) => resolve(resultat)
    return c
  }
  const client = {
    from: vi.fn((table: string) => {
      tables.push(table)
      if (table === 'tenants') return chaine({ data: [{ id: 'florna', name: 'Florna', code: 'FLORNA', is_active: true }], error: null })
      if (table === 'sync_runs') return chaine({ data: [{ ended_at: '2026-10-09T20:00:00Z', status: 'success' }], error: null })
      if (table === 'profiles') return chaine({ data: null, error: null, count: 2 })
      return chaine({ data: [], error: null, count: 0 })
    }),
    rpc: vi.fn(() => chaine(rpcResultat)),
  }
  return { client, tables }
}

describe('GET /api/hub/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuse tout autre role que super_admin', async () => {
    mockGetFastUser.mockResolvedValue({ ...superAdmin, role: 'admin' })
    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('reprend les chiffres du tableau de bord du client, sans sommer les colis', async () => {
    // L'ancienne somme ligne a ligne s'arretait aux 1 000 premiers colis :
    // 5 454,99 EUR affiches pour 19 242,02 EUR reels chez Florna le 09/10.
    const { client, tables } = fauxClient({ data: lignesFlorna, error: null })
    mockGetFastUser.mockResolvedValue(superAdmin)
    mockGetAdminDb.mockReturnValue(client)

    const response = await GET()
    const corps = await response.json()

    expect(response.status).toBe(200)
    expect(corps.tenants[0]).toMatchObject({ code: 'FLORNA', shipments: 3854, cost: 19242.02, missingPricing: 6068 })
    expect(corps.totals).toMatchObject({ shipments: 3854, cost: 19242.02, missingPricing: 6068 })
    expect(client.rpc).toHaveBeenCalledWith('get_dashboard_metrics', expect.objectContaining({
      p_tenant_id: 'florna',
      p_month_start: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      p_month_end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      p_yesterday: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }))
    expect(tables).not.toContain('shipments')
  })

  it('journalise un echec de la fonction au lieu d afficher 0 en silence', async () => {
    const { client } = fauxClient({ data: null, error: { message: 'canceling statement due to statement timeout' } })
    mockGetFastUser.mockResolvedValue(superAdmin)
    mockGetAdminDb.mockReturnValue(client)
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const response = await GET()
      expect(response.status).toBe(200)
      expect(journal).toHaveBeenCalledWith(
        '[Hub] get_dashboard_metrics en echec pour FLORNA :',
        'canceling statement due to statement timeout',
      )
    } finally {
      journal.mockRestore()
    }
  })
})
