import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAdminDb } = vi.hoisted(() => ({ mockGetAdminDb: vi.fn() }))

vi.mock('@/lib/supabase/untyped', () => ({ getAdminDb: mockGetAdminDb }))

import { restockShipmentStock } from './consume'

describe('restockShipmentStock', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdminDb.mockReturnValue({ rpc })
  })

  it('delegates the inverse CAS and all stock deltas to one atomic RPC', async () => {
    rpc.mockResolvedValue({
      data: [{ restocked: true, item_count: 2 }],
      error: null,
    })

    await expect(restockShipmentStock('tenant-1', 'shipment-1')).resolves.toEqual({
      restocked: true,
      count: 2,
    })
    expect(rpc).toHaveBeenCalledWith('restock_shipment_stock', {
      p_tenant_id: 'tenant-1',
      p_shipment_id: 'shipment-1',
      p_reason: 'Annulation colis',
    })
  })

  it('throws so callers and the sweeper can retry an atomic rollback', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })

    await expect(restockShipmentStock('tenant-1', 'shipment-1')).rejects.toThrow(
      'restock_shipment_stock failed for shipment shipment-1: database unavailable',
    )
  })
})
