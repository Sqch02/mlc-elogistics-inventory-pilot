import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractRawItem,
  resolveAndCreateShipmentItem,
  processShipmentItems,
} from './sku-mapping'

/**
 * Create a mock admin Supabase client with chainable .from().eq()...maybeSingle()
 * plus rpc / upsert.
 *
 * Usage:
 *   const { client, rpcMock, itemUpsertMock, unmappedUpsertMock, maybeSingleMock }
 *     = createMockAdminClient({ resolvedSkuId: 'sku-1' })
 */
function createMockAdminClient(opts: {
  resolvedSkuId?: string | null
  rpcError?: { message: string } | null
  batchRpcError?: { message: string } | null
  existingShipmentItem?: { id: string; qty: number } | null
  itemUpsertError?: { message: string } | null
  unmappedUpsertError?: { message: string } | null
} = {}) {
  const {
    resolvedSkuId = null,
    rpcError = null,
    batchRpcError = null,
    existingShipmentItem = null,
    itemUpsertError = null,
    unmappedUpsertError = null,
  } = opts

  const rpcMock = vi.fn((rpcName: string, args: Record<string, unknown>) => {
    if (rpcName === 'map_shipment_items_batch') {
      const items = args.p_items as unknown[]
      return Promise.resolve({
        data: batchRpcError
          ? null
          : items.map((_, itemIndex) => ({
              item_index: itemIndex,
              sku_id: resolvedSkuId,
            })),
        error: batchRpcError,
      })
    }

    return Promise.resolve({ data: resolvedSkuId, error: rpcError })
  })

  const maybeSingleMock = vi
    .fn()
    .mockResolvedValue({ data: existingShipmentItem, error: null })

  const itemUpsertMock = vi
    .fn()
    .mockResolvedValue({ data: null, error: itemUpsertError })
  const unmappedUpsertMock = vi
    .fn()
    .mockResolvedValue({ data: null, error: unmappedUpsertError })
  const unmappedInsertMock = vi
    .fn()
    .mockResolvedValue({ data: null, error: unmappedUpsertError })

  const fromMock = vi.fn((table: string) => {
    if (table === 'shipment_items') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: maybeSingleMock,
        upsert: itemUpsertMock,
      }
    }
    if (table === 'unmapped_items') {
      return {
        upsert: unmappedUpsertMock,
        insert: unmappedInsertMock,
        delete: vi.fn(() => {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
          return chain
        }),
      }
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  return {
    client: { from: fromMock, rpc: rpcMock },
    rpcMock,
    maybeSingleMock,
    itemUpsertMock,
    unmappedUpsertMock,
    fromMock,
  }
}

describe('extractRawItem', () => {
  it('extracts sku, description, variant_id and quantity from a Sendcloud parcel_item', () => {
    const parcelItem = {
      sku: 'FLRN-CANDLE-001',
      description: 'Scented Candle - Vanilla',
      variant_id: 'gid://shopify/ProductVariant/1234567890',
      product_id: 'gid://shopify/Product/9876543210',
      quantity: 2,
    }

    const extracted = extractRawItem(parcelItem)

    expect(extracted).toEqual({
      sku: 'FLRN-CANDLE-001',
      description: 'Scented Candle - Vanilla',
      variant_id: 'gid://shopify/ProductVariant/1234567890',
      product_id: 'gid://shopify/Product/9876543210',
      qty: 2,
    })
  })

  it('normalizes empty or whitespace strings to null', () => {
    const extracted = extractRawItem({
      sku: '   ',
      description: '',
      variant_id: null,
      product_id: undefined,
      quantity: 1,
    })

    expect(extracted.sku).toBeNull()
    expect(extracted.description).toBeNull()
    expect(extracted.variant_id).toBeNull()
    expect(extracted.product_id).toBeNull()
    expect(extracted.qty).toBe(1)
  })

  it('defaults quantity to 1 when missing or invalid', () => {
    expect(extractRawItem({ sku: 'X' }).qty).toBe(1)
    expect(extractRawItem({ sku: 'X', quantity: 0 }).qty).toBe(1)
    expect(extractRawItem({ sku: 'X', quantity: -5 }).qty).toBe(1)
    expect(extractRawItem({ sku: 'X', quantity: 'abc' }).qty).toBe(1)
  })

  it('parses string quantities', () => {
    expect(extractRawItem({ sku: 'X', quantity: '3' }).qty).toBe(3)
  })

  it('preserves full Shopify gid format for variant_id', () => {
    const gid = 'gid://shopify/ProductVariant/42'
    const extracted = extractRawItem({ sku: null, variant_id: gid, quantity: 1 })
    expect(extracted.variant_id).toBe(gid)
  })
})

describe('resolveAndCreateShipmentItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a shipment_item and returns { mapped: true } when RPC resolves a SKU', async () => {
    const { client, rpcMock, itemUpsertMock, unmappedUpsertMock } = createMockAdminClient({
      resolvedSkuId: 'sku-uuid-1',
    })

    const result = await resolveAndCreateShipmentItem(client, 'tenant-1', 'shipment-1', {
      sku: 'FLRN-001',
      description: 'Candle',
      variant_id: null,
      product_id: null,
      qty: 2,
    })

    expect(result).toEqual({ mapped: true, skuId: 'sku-uuid-1' })
    expect(rpcMock).toHaveBeenCalledWith('map_shipment_item', {
      p_tenant_id: 'tenant-1',
      p_raw_sku: 'FLRN-001',
      p_raw_description: 'Candle',
      p_raw_variant_id: null,
    })
    expect(itemUpsertMock).toHaveBeenCalledTimes(1)
    // qty should be 0 (no existing) + 2 = 2
    expect(itemUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        shipment_id: 'shipment-1',
        sku_id: 'sku-uuid-1',
        qty: 2,
      }),
      expect.objectContaining({ onConflict: 'shipment_id,sku_id' }),
    )
    expect(unmappedUpsertMock).not.toHaveBeenCalled()
  })

  it('creates an unmapped_items row when the RPC returns null (unknown SKU)', async () => {
    const { client, itemUpsertMock, unmappedUpsertMock } = createMockAdminClient({
      resolvedSkuId: null,
    })

    const result = await resolveAndCreateShipmentItem(client, 'tenant-1', 'shipment-1', {
      sku: 'UNKNOWN-SKU-999',
      description: 'Mystery item',
      variant_id: null,
      product_id: null,
      qty: 1,
    })

    expect(result).toEqual({ mapped: false })
    expect(itemUpsertMock).not.toHaveBeenCalled()
    expect(unmappedUpsertMock).toHaveBeenCalledTimes(1)
    expect(unmappedUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        shipment_id: 'shipment-1',
        raw_sku: 'UNKNOWN-SKU-999',
        raw_description: 'Mystery item',
        qty: 1,
      }),
      expect.any(Object),
    )
  })

  it('resolves via variant_id when sku is empty', async () => {
    const { client, rpcMock, itemUpsertMock } = createMockAdminClient({
      resolvedSkuId: 'sku-uuid-by-variant',
    })

    const result = await resolveAndCreateShipmentItem(client, 'tenant-1', 'shipment-1', {
      sku: null,
      description: null,
      variant_id: 'gid://shopify/ProductVariant/1234567890',
      product_id: null,
      qty: 1,
    })

    expect(result).toEqual({ mapped: true, skuId: 'sku-uuid-by-variant' })
    expect(rpcMock).toHaveBeenCalledWith('map_shipment_item', {
      p_tenant_id: 'tenant-1',
      p_raw_sku: null,
      p_raw_description: null,
      p_raw_variant_id: 'gid://shopify/ProductVariant/1234567890',
    })
    expect(itemUpsertMock).toHaveBeenCalledTimes(1)
  })

  it('replaces qty (no accumulation) when reprocessing the same (shipment, sku) pair', async () => {
    // REPLACE semantics: bug fixed 28/05 on R21 (qty was accumulated to 2 when
    // webhook + cron both processed the same parcel with qty=1). Re-running
    // the upsert with the same Sendcloud payload must yield the same qty.
    const { client, itemUpsertMock } = createMockAdminClient({
      resolvedSkuId: 'sku-uuid-1',
      existingShipmentItem: { id: 'existing-row-id', qty: 3 },
    })

    await resolveAndCreateShipmentItem(client, 'tenant-1', 'shipment-1', {
      sku: 'FLRN-001',
      description: null,
      variant_id: null,
      product_id: null,
      qty: 2,
    })

    // Upserted with qty = 2 (the raw item qty), not 3+2=5.
    expect(itemUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ qty: 2 }),
      expect.any(Object),
    )
  })

  it('processShipmentItems aggregates qty across duplicate sku entries in the same batch', async () => {
    // Sendcloud sometimes emits two parcel_items for the same SKU instead of
    // one with qty=N. Within a single processing call we MUST sum these so
    // they don't overwrite each other (the REPLACE upsert would otherwise
    // keep only the last one).
    const { client, rpcMock, itemUpsertMock } = createMockAdminClient({
      resolvedSkuId: 'sku-uuid-1',
    })

    const result = await processShipmentItems(client, 'tenant-1', 'shipment-1', [
      { sku: 'FLRN-001', quantity: 2 },
      { sku: 'FLRN-001', quantity: 3 },
    ])

    expect(result).toEqual({ mappedCount: 1, unmappedCount: 0 })
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('map_shipment_items_batch', {
      p_tenant_id: 'tenant-1',
      p_items: [
        {
          raw_sku: 'FLRN-001',
          raw_description: null,
          raw_variant_id: null,
        },
        {
          raw_sku: 'FLRN-001',
          raw_description: null,
          raw_variant_id: null,
        },
      ],
    })
    // Single upsert with aggregated qty = 2 + 3 = 5
    expect(itemUpsertMock).toHaveBeenCalledTimes(1)
    expect(itemUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ qty: 5, sku_id: 'sku-uuid-1' }),
      expect.any(Object),
    )
  })
})

describe('processShipmentItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero counts for empty or missing parcel_items array', async () => {
    const { client } = createMockAdminClient()

    const empty = await processShipmentItems(client, 'tenant-1', 'shipment-1', [])
    expect(empty).toEqual({ mappedCount: 0, unmappedCount: 0 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missing = await processShipmentItems(client, 'tenant-1', 'shipment-1', null as any)
    expect(missing).toEqual({ mappedCount: 0, unmappedCount: 0 })
  })

  it('skips parcel_items that have no identifying info at all', async () => {
    const { client, rpcMock } = createMockAdminClient()

    const result = await processShipmentItems(client, 'tenant-1', 'shipment-1', [
      { sku: '', description: '', variant_id: null, quantity: 1 },
      null,
      'not-an-object',
    ])

    expect(result).toEqual({ mappedCount: 0, unmappedCount: 0 })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('falls back to per-item mapping when the batch RPC is not deployed yet', async () => {
    const { client, rpcMock, itemUpsertMock } = createMockAdminClient({
      resolvedSkuId: 'sku-fallback',
      batchRpcError: { message: 'Function not found' },
    })

    const result = await processShipmentItems(client, 'tenant-1', 'shipment-1', [
      { sku: 'SKU-A', quantity: 1 },
      { sku: 'SKU-B', quantity: 2 },
    ])

    expect(result).toEqual({ mappedCount: 1, unmappedCount: 0 })
    expect(rpcMock).toHaveBeenCalledTimes(3)
    expect(rpcMock.mock.calls.map(([rpcName]) => rpcName)).toEqual([
      'map_shipment_items_batch',
      'map_shipment_item',
      'map_shipment_item',
    ])
    expect(itemUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ sku_id: 'sku-fallback', qty: 3 }),
      expect.any(Object),
    )
  })
})
