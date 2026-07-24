import { describe, expect, it, vi } from 'vitest'
import { reverseDuplicateShipmentStock } from './reverse-duplicates'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

function createFallbackClient(stillConsumedIds: string[] = ['shipment-a', 'shipment-b']) {
  const rpc = vi.fn((rpcName: string) => {
    if (rpcName === 'reverse_duplicate_shipment_stock') {
      return Promise.resolve({
        data: null,
        error: { message: 'Function not found' },
      })
    }
    return Promise.resolve({ data: [], error: null })
  })

  // Effet REEL du ledger (qty_before - qty_after), pas le delta demande :
  // apply_stock_delta planche a GREATEST(0, ...), donc les deux divergent des
  // qu'une consommation a touche zero.
  const movementsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn(function inFilter(this: unknown, column: string) {
      if (column === 'reference_id') {
        return Promise.resolve({
          data: [
            { sku_id: 'sku-a', qty_before: 10, qty_after: 8 },
            { sku_id: 'sku-a', qty_before: 8, qty_after: 7 },
            { sku_id: 'sku-b', qty_before: 10, qty_after: 6 },
          ],
          error: null,
        })
      }
      return movementsQuery
    }),
  }
  // Seuls les colis encore marques consommes peuvent etre recredites.
  const shipmentsSelect = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockResolvedValue({
      data: stillConsumedIds.map((id) => ({ id })),
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
      return { ...shipmentsSelect, delete: vi.fn(() => shipmentDelete) }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    client: { rpc, from } as unknown as AdminClient,
    rpc,
    from,
    shipmentDelete,
    shipmentsSelect,
  }
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
      { rpc, from } as unknown as AdminClient,
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
      { rpc, from } as unknown as AdminClient,
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
  it('credits nothing for a shipment already refunded, but still deletes it', async () => {
    // Marqueur NULL = stock deja rendu (annulation, sweeper ou recalibration).
    // Le recrediter serait une seconde restitution : c'est le bug corrige en 00098.
    const { client, rpc, shipmentDelete } = createFallbackClient([])

    const result = await reverseDuplicateShipmentStock(
      client,
      'tenant-1',
      ['shipment-a', 'shipment-b'],
    )

    expect(result).toMatchObject({ skusReversed: 0, unitsReversed: 0, usedFallback: true })
    expect(rpc.mock.calls.filter(([name]) => name === 'apply_stock_delta')).toHaveLength(0)
    // Le doublon doit quand meme disparaitre.
    expect(shipmentDelete.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
  })
})
