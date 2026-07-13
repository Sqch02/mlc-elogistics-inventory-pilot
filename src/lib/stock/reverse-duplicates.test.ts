import { describe, expect, it, vi } from 'vitest'
import { reverseDuplicateShipmentStock } from './reverse-duplicates'

function createFallbackClient() {
  const rpc = vi.fn((rpcName: string) => {
    if (rpcName === 'reverse_duplicate_shipment_stock') {
      return Promise.resolve({
        data: null,
        error: { message: 'Function not found' },
      })
    }
    return Promise.resolve({ data: [], error: null })
  })

  const movementsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({
      data: [
        { sku_id: 'sku-a', adjustment: -2 },
        { sku_id: 'sku-a', adjustment: -1 },
        { sku_id: 'sku-b', adjustment: -4 },
      ],
      error: null,
    }),
  }
  const shipmentDelete = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  const from = vi.fn((table: string) => {
    if (table === 'stock_movements') return movementsQuery
    if (table === 'shipments') {
      return { delete: vi.fn(() => shipmentDelete) }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { client: { rpc, from }, rpc, from, shipmentDelete }
}

describe('reverseDuplicateShipmentStock', () => {
  it('uses one transactional RPC when migration 00090 is available', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        shipments_deleted: 2,
        skus_reversed: 3,
        units_reversed: 7,
      }],
      error: null,
    })
    const from = vi.fn()

    const result = await reverseDuplicateShipmentStock(
      { rpc, from },
      'tenant-1',
      ['shipment-a', 'shipment-b'],
    )

    expect(result).toEqual({
      shipmentsDeleted: 2,
      skusReversed: 3,
      unitsReversed: 7,
      usedFallback: false,
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('reverse_duplicate_shipment_stock', {
      p_tenant_id: 'tenant-1',
      p_shipment_ids: ['shipment-a', 'shipment-b'],
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('uses the safe legacy path before migration 00090 is deployed', async () => {
    const { client, rpc, shipmentDelete } = createFallbackClient()

    const result = await reverseDuplicateShipmentStock(
      client,
      'tenant-1',
      ['shipment-a', 'shipment-b'],
    )

    expect(result).toEqual({
      shipmentsDeleted: 2,
      skusReversed: 2,
      unitsReversed: 7,
      usedFallback: true,
    })
    expect(rpc.mock.calls.map(([rpcName]) => rpcName)).toEqual([
      'reverse_duplicate_shipment_stock',
      'apply_stock_delta',
      'apply_stock_delta',
    ])
    expect(rpc).toHaveBeenCalledWith('apply_stock_delta', expect.objectContaining({
      p_tenant_id: 'tenant-1',
      p_sku_id: 'sku-a',
      p_delta: 3,
      p_movement_type: 'manual',
    }))
    expect(rpc).toHaveBeenCalledWith('apply_stock_delta', expect.objectContaining({
      p_sku_id: 'sku-b',
      p_delta: 4,
    }))
    expect(shipmentDelete.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
    expect(shipmentDelete.in).toHaveBeenCalledWith(
      'id',
      ['shipment-a', 'shipment-b'],
    )
  })

  it('does nothing for an empty duplicate set', async () => {
    const rpc = vi.fn()
    const from = vi.fn()

    await expect(reverseDuplicateShipmentStock(
      { rpc, from },
      'tenant-1',
      [],
    )).resolves.toEqual({
      shipmentsDeleted: 0,
      skusReversed: 0,
      unitsReversed: 0,
      usedFallback: false,
    })
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})
