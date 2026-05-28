/**
 * Robust SKU mapping helpers for Sendcloud parcel_items.
 *
 * Flow:
 *   1. Extract every raw parcel_item from Sendcloud's payload.
 *   2. Resolve each one against the SKU hierarchy via `map_shipment_item` RPC:
 *      sku_code → variant_id → sku_mappings (variant_id / sku_alias / description).
 *   3. Aggregate qty by resolved sku_id WITHIN a single processing call so that
 *      Sendcloud's "multiple line items with same SKU" case is handled.
 *   4. Upsert the aggregated qty into `shipment_items` with REPLACE semantics
 *      (not accumulate). This makes reprocessing the same parcel idempotent
 *      (bug observed 28/05 on R21 activator: webhook + cron both ran on
 *      Jennifer Kergrohen parcel, accumulating shipment_items.qty from 1 to 2
 *      even though Sendcloud reported qty=1, while stock was correctly
 *      decremented only once).
 *   5. Unmapped items go to `unmapped_items` so nothing is lost.
 */

import { getAdminDb } from '@/lib/supabase/untyped'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any
export type SupabaseClient = ReturnType<typeof getAdminDb>

export interface RawShipmentItem {
  sku: string | null
  description: string | null
  variant_id: string | null
  product_id: string | null
  qty: number
}

export interface ResolveResult {
  mapped: boolean
  skuId?: string
}

/**
 * Normalize a value from a raw Sendcloud parcel_item into a non-empty trimmed
 * string or null (empty / whitespace-only strings become null).
 */
function normalize(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str.length === 0 ? null : str
}

/**
 * Extract a normalized RawShipmentItem from a raw Sendcloud parcel_item.
 * Handles both snake_case Sendcloud fields and fallbacks.
 */
export function extractRawItem(rawParcelItem: Record<string, unknown>): RawShipmentItem {
  const qtyRaw = rawParcelItem.quantity ?? rawParcelItem.qty ?? 1
  const qty = typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw), 10) || 1

  return {
    sku: normalize(rawParcelItem.sku),
    description: normalize(rawParcelItem.description),
    // Keep the full gid://shopify/ProductVariant/XXX string so matching against
    // skus.shopify_variant_id or sku_mappings.pattern works as-is.
    variant_id: normalize(rawParcelItem.variant_id),
    product_id: normalize(rawParcelItem.product_id),
    qty: qty > 0 ? qty : 1,
  }
}

/**
 * Resolve a raw item to a sku_id via the DB RPC, without persisting.
 * Returns the resolved sku_id or null if no match.
 */
async function resolveSkuId(
  adminClient: AdminClient,
  tenantId: string,
  rawItem: RawShipmentItem,
): Promise<string | null> {
  const { data: skuId, error: rpcError } = await adminClient.rpc('map_shipment_item', {
    p_tenant_id: tenantId,
    p_raw_sku: rawItem.sku,
    p_raw_description: rawItem.description,
    p_raw_variant_id: rawItem.variant_id,
  })

  if (rpcError) {
    console.error('[sku-mapping] map_shipment_item RPC error:', rpcError.message)
    return null
  }

  return skuId && typeof skuId === 'string' ? skuId : null
}

/**
 * Resolve a single raw shipment item AND immediately persist it. Kept as a
 * public helper for callers that need to push items one by one (manual flows,
 * tests). For the regular parcel processing pipeline use `processShipmentItems`
 * which aggregates qty per sku before persisting.
 */
export async function resolveAndCreateShipmentItem(
  adminClient: AdminClient,
  tenantId: string,
  shipmentId: string,
  rawItem: RawShipmentItem,
): Promise<ResolveResult> {
  const skuId = await resolveSkuId(adminClient, tenantId, rawItem)

  if (skuId) {
    // REPLACE semantics: the qty stored is the qty Sendcloud reports for this
    // single parcel_item, not an accumulation. If callers need to combine
    // multiple raw items with the same SKU, they must aggregate before calling
    // this function (see `processShipmentItems`).
    const { error: upsertError } = await adminClient
      .from('shipment_items')
      .upsert(
        {
          tenant_id: tenantId,
          shipment_id: shipmentId,
          sku_id: skuId,
          qty: rawItem.qty,
        },
        { onConflict: 'shipment_id,sku_id' },
      )

    if (upsertError) {
      console.error('[sku-mapping] shipment_items upsert error:', upsertError.message)
      return { mapped: false }
    }

    return { mapped: true, skuId }
  }

  // Not mapped → record in unmapped_items so nothing is lost.
  const { error: unmappedError } = await adminClient
    .from('unmapped_items')
    .upsert(
      {
        tenant_id: tenantId,
        shipment_id: shipmentId,
        raw_sku: rawItem.sku,
        raw_description: rawItem.description,
        raw_variant_id: rawItem.variant_id,
        raw_product_id: rawItem.product_id,
        qty: rawItem.qty,
      },
      { onConflict: 'shipment_id,raw_sku,raw_description,raw_variant_id' },
    )

  if (unmappedError) {
    console.error('[sku-mapping] unmapped_items upsert error:', unmappedError.message)
  }

  return { mapped: false }
}

/**
 * Process all parcel_items of a shipment in one go:
 *   1. resolve each raw item to a sku_id
 *   2. aggregate qty per sku within this batch (Sendcloud sometimes emits two
 *      line items for the same SKU rather than one with qty=2)
 *   3. upsert into shipment_items with REPLACE semantics (idempotent on
 *      reprocessing — see file header for the R21 incident this fixes)
 *   4. upsert unmapped items
 *
 * Returns counts for logging purposes.
 */
export async function processShipmentItems(
  adminClient: AdminClient,
  tenantId: string,
  shipmentId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parcelItems: any[],
): Promise<{ mappedCount: number; unmappedCount: number }> {
  if (!Array.isArray(parcelItems) || parcelItems.length === 0) {
    return { mappedCount: 0, unmappedCount: 0 }
  }

  // Step 1: extract + resolve each parcel item
  const resolved: Array<{ item: RawShipmentItem; skuId: string | null }> = []
  for (const rawParcelItem of parcelItems) {
    if (!rawParcelItem || typeof rawParcelItem !== 'object') continue
    const item = extractRawItem(rawParcelItem as Record<string, unknown>)
    // Skip items with no identifying info AND no description
    if (!item.sku && !item.description && !item.variant_id && !item.product_id) continue

    try {
      const skuId = await resolveSkuId(adminClient, tenantId, item)
      resolved.push({ item, skuId })
    } catch (err) {
      console.error('[sku-mapping] resolveSkuId threw:', err)
      resolved.push({ item, skuId: null })
    }
  }

  // Step 2: aggregate qty per sku within this batch
  const mappedTotals = new Map<string, number>()
  const unmappedRows: RawShipmentItem[] = []
  for (const { item, skuId } of resolved) {
    if (skuId) {
      mappedTotals.set(skuId, (mappedTotals.get(skuId) ?? 0) + item.qty)
    } else {
      unmappedRows.push(item)
    }
  }

  // Step 3: upsert mapped items with REPLACE semantics. Each (shipment, sku)
  // pair is upserted with the aggregated qty for THIS batch. If the same
  // shipment is reprocessed later (webhook then cron, or two cron runs), the
  // qty is replaced with the same value — no double-counting.
  for (const [skuId, qty] of mappedTotals) {
    const { error: upsertError } = await adminClient
      .from('shipment_items')
      .upsert(
        {
          tenant_id: tenantId,
          shipment_id: shipmentId,
          sku_id: skuId,
          qty,
        },
        { onConflict: 'shipment_id,sku_id' },
      )

    if (upsertError) {
      console.error('[sku-mapping] shipment_items upsert error:', upsertError.message)
    }
  }

  // Step 4: upsert unmapped items (still per row — there's no clean aggregation
  // when sku is unknown).
  for (const item of unmappedRows) {
    const { error: unmappedError } = await adminClient
      .from('unmapped_items')
      .upsert(
        {
          tenant_id: tenantId,
          shipment_id: shipmentId,
          raw_sku: item.sku,
          raw_description: item.description,
          raw_variant_id: item.variant_id,
          raw_product_id: item.product_id,
          qty: item.qty,
        },
        { onConflict: 'shipment_id,raw_sku,raw_description,raw_variant_id' },
      )

    if (unmappedError) {
      console.error('[sku-mapping] unmapped_items upsert error:', unmappedError.message)
    }
  }

  return {
    mappedCount: mappedTotals.size,
    unmappedCount: unmappedRows.length,
  }
}
