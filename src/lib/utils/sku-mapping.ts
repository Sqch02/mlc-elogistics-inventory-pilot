/**
 * Robust SKU mapping helpers for Sendcloud parcel_items.
 *
 * Flow:
 *   1. Call the `map_shipment_item` RPC which walks the hierarchy:
 *      sku_code → variant_id → sku_mappings (variant_id / sku_alias / description).
 *   2. If the RPC returns a UUID → upsert into `shipment_items` (qty accumulated
 *      on conflict with existing row on shipment_id + sku_id).
 *   3. If the RPC returns null → persist to `unmapped_items` so no item is lost.
 *
 * The goal is that EVERY parcel_item coming from Sendcloud is either mapped or
 * stored in `unmapped_items` for later resolution.
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
 * Resolve a raw shipment item against the SKU hierarchy via the
 * `map_shipment_item` RPC, then persist either to `shipment_items` (if mapped)
 * or to `unmapped_items` (if not).
 */
export async function resolveAndCreateShipmentItem(
  adminClient: AdminClient,
  tenantId: string,
  shipmentId: string,
  rawItem: RawShipmentItem,
): Promise<ResolveResult> {
  // Call the DB-side resolver. It uses the mapping hierarchy:
  //   sku_code → shopify_variant_id → sku_mappings (variant_id | sku_alias | description)
  const { data: skuId, error: rpcError } = await adminClient.rpc('map_shipment_item', {
    p_tenant_id: tenantId,
    p_raw_sku: rawItem.sku,
    p_raw_description: rawItem.description,
    p_raw_variant_id: rawItem.variant_id,
  })

  if (rpcError) {
    console.error('[sku-mapping] map_shipment_item RPC error:', rpcError.message)
  }

  if (skuId && typeof skuId === 'string') {
    // Mapped → upsert into shipment_items. Because upsert can't atomically
    // increment qty on conflict, we read the existing row first and sum.
    const { data: existing } = await adminClient
      .from('shipment_items')
      .select('id, qty')
      .eq('shipment_id', shipmentId)
      .eq('sku_id', skuId)
      .maybeSingle()

    const existingQty = (existing?.qty as number | undefined) ?? 0
    const newQty = existingQty + rawItem.qty

    const { error: upsertError } = await adminClient
      .from('shipment_items')
      .upsert(
        {
          tenant_id: tenantId,
          shipment_id: shipmentId,
          sku_id: skuId,
          qty: newQty,
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
 * Process all parcel_items of a shipment: iterate, resolve, persist.
 * Returns counts of mapped / unmapped items for logging purposes.
 */
export async function processShipmentItems(
  adminClient: AdminClient,
  tenantId: string,
  shipmentId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parcelItems: any[],
): Promise<{ mappedCount: number; unmappedCount: number }> {
  let mappedCount = 0
  let unmappedCount = 0

  if (!Array.isArray(parcelItems) || parcelItems.length === 0) {
    return { mappedCount, unmappedCount }
  }

  for (const rawParcelItem of parcelItems) {
    if (!rawParcelItem || typeof rawParcelItem !== 'object') continue

    const rawItem = extractRawItem(rawParcelItem as Record<string, unknown>)

    // Skip items with no identifying info AND no description
    if (!rawItem.sku && !rawItem.description && !rawItem.variant_id && !rawItem.product_id) {
      continue
    }

    try {
      const result = await resolveAndCreateShipmentItem(adminClient, tenantId, shipmentId, rawItem)
      if (result.mapped) mappedCount++
      else unmappedCount++
    } catch (err) {
      console.error('[sku-mapping] resolveAndCreateShipmentItem threw:', err)
      unmappedCount++
    }
  }

  return { mappedCount, unmappedCount }
}
