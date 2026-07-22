import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/auth', () => ({ requireRole: vi.fn(), requireTenant: vi.fn() }))
vi.mock('@/lib/supabase/untyped', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/stock/consume', () => ({ consumeShipmentStockOnce: vi.fn() }))

import { POST } from './route'
import { requireRole, requireTenant } from '@/lib/supabase/auth'
import { getAdminDb } from '@/lib/supabase/untyped'
import { consumeShipmentStockOnce } from '@/lib/stock/consume'

function awaitable(data: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
  }
  return chain
}

describe('POST /api/stock/recalculate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireRole).mockResolvedValue({} as never)
    vi.mocked(requireTenant).mockResolvedValue('tenant-1')
    vi.mocked(consumeShipmentStockOnce).mockResolvedValue({ consumed: true, count: 1 })
  })

  it('filters On Hold and routes only mapped shipped rows through the central RPC', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'shipments') {
          return { select: vi.fn(() => awaitable([
            { id: 'hold', status_id: null, status_message: 'On Hold', is_return: false },
            { id: 'shipped', status_id: null, status_message: 'Fulfilled', is_return: false },
          ])) }
        }
        if (table === 'shipment_items') {
          return { select: vi.fn(() => awaitable([{ shipment_id: 'shipped' }])) }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    }
    vi.mocked(getAdminDb).mockReturnValue(client as unknown as ReturnType<typeof getAdminDb>)

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats).toMatchObject({ total: 1, processed: 1, skipped: 0, errors: 0 })
    expect(consumeShipmentStockOnce).toHaveBeenCalledOnce()
    expect(consumeShipmentStockOnce).toHaveBeenCalledWith('tenant-1', 'shipped')
    expect(requireRole).toHaveBeenCalledWith(['super_admin', 'admin', 'ops'])
  })
})
