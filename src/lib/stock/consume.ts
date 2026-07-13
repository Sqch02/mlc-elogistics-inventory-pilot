/**
 * Stock Consumption Logic
 *
 * P1-stock: toute la mutation de stock passe desormais par le RPC atomique
 * `apply_stock_delta` (verrou FOR UPDATE + GREATEST(0,..) + decomposition bundle
 * recursive + trace stock_movements). L'ancien decrementSkuStock etait un
 * read-modify-write non atomique (lost-update sous acces concurrent webhook+cron).
 *
 * La consommation au niveau d'une EXPEDITION passe par consumeShipmentStockOnce,
 * qui pose un verrou logique idempotent via un compare-and-swap sur
 * shipments.stock_consumed_at : quel que soit l'ordre webhook/cron/sync manuel,
 * une expedition n'est consommee qu'UNE fois. La reprise sur annulation
 * (restockShipmentStock) fait le CAS inverse.
 */

import { getAdminDb } from '@/lib/supabase/untyped'

interface StockConsumptionResult {
  sku_id: string
  qty_consumed: number
  qty_before: number
  qty_after: number
  is_bundle_component: boolean
}

interface DeltaRow {
  sku_id: string
  qty_before: number
  qty_after: number
  was_bundle: boolean
}

/**
 * Apply an atomic stock delta for one (bundle or simple) SKU via apply_stock_delta.
 * Negative qty consumes, e.g. consumeStock(t, sku, 3) removes 3 units.
 */
export async function consumeStock(
  tenantId: string,
  skuId: string,
  qty: number,
  referenceId?: string,
  referenceType?: string,
): Promise<StockConsumptionResult[]> {
  const adminClient = getAdminDb()

  const { data, error } = await adminClient.rpc('apply_stock_delta', {
    p_tenant_id: tenantId,
    p_sku_id: skuId,
    p_delta: -qty,
    p_reason: qty >= 0 ? 'Expédition' : 'Annulation colis',
    p_reference_id: referenceId ?? null,
    p_reference_type: referenceType ?? null,
    p_movement_type: qty >= 0 ? 'shipment' : 'restock',
  })

  if (error) {
    console.error(`[Stock] apply_stock_delta error for sku ${skuId}:`, error.message)
    return []
  }

  return ((data ?? []) as DeltaRow[]).map((r) => ({
    sku_id: r.sku_id,
    qty_consumed: qty,
    qty_before: r.qty_before,
    qty_after: r.qty_after,
    is_bundle_component: r.was_bundle,
  }))
}

/**
 * Consume stock for ALL items of a shipment, exactly once.
 *
 * Compare-and-swap on shipments.stock_consumed_at: the first caller to flip it
 * from NULL to now() wins and performs the consumption; any concurrent or later
 * caller (the classic webhook-vs-cron race on a freshly-created parcel) sees a
 * non-NULL value, claims nothing, and skips. This replaces the non-atomic
 * `isNewShipment` existence check as the source of idempotency.
 *
 * Callers should still gate on "this shipment is new AND has mapped items" to
 * avoid marking an all-unmapped shipment as consumed before its items resolve.
 *
 * @returns { consumed } false if another path already consumed this shipment.
 */
export async function consumeShipmentStockOnce(
  tenantId: string,
  shipmentId: string,
): Promise<{ consumed: boolean; count: number }> {
  const adminClient = getAdminDb()

  // All-or-nothing: the CAS claim on stock_consumed_at AND every item's
  // apply_stock_delta run inside ONE transaction (consume_shipment_stock RPC).
  // If any item fails, the whole thing rolls back so the shipment is never left
  // "claimed but partially consumed" — stock_consumed_at stays NULL and the
  // shipment can be re-driven. We deliberately THROW on RPC error (instead of
  // swallowing per-item failures) so the caller logs it and does not treat a
  // rolled-back shipment as consumed.
  const { data, error } = await adminClient.rpc('consume_shipment_stock', {
    p_tenant_id: tenantId,
    p_shipment_id: shipmentId,
  })

  if (error) {
    throw new Error(
      `consume_shipment_stock failed for shipment ${shipmentId}: ${error.message}`,
    )
  }

  const row = ((data ?? []) as Array<{ consumed: boolean; item_count: number }>)[0]
  return { consumed: row?.consumed ?? false, count: row?.item_count ?? 0 }
}

/**
 * Reverse the stock consumption of a shipment (parcel cancelled), exactly once.
 *
 * CAS in the other direction: only a shipment currently marked consumed
 * (stock_consumed_at IS NOT NULL) is restocked, and the marker is cleared in the
 * same atomic step so two cancel events cannot double-restock.
 *
 * @returns { restocked } false if the shipment was not consumed / already reversed.
 */
export async function restockShipmentStock(
  tenantId: string,
  shipmentId: string,
): Promise<{ restocked: boolean; count: number }> {
  const adminClient = getAdminDb()

  const { data: claimed } = await adminClient
    .from('shipments')
    .update({ stock_consumed_at: null })
    .eq('tenant_id', tenantId)
    .eq('id', shipmentId)
    .not('stock_consumed_at', 'is', null)
    .select('id')

  if (!claimed || claimed.length === 0) {
    return { restocked: false, count: 0 }
  }

  const { data: items } = await adminClient
    .from('shipment_items')
    .select('sku_id, qty')
    .eq('tenant_id', tenantId)
    .eq('shipment_id', shipmentId)

  let count = 0
  for (const it of (items ?? []) as Array<{ sku_id: string; qty: number }>) {
    try {
      await adminClient.rpc('apply_stock_delta', {
        p_tenant_id: tenantId,
        p_sku_id: it.sku_id,
        p_delta: it.qty,
        p_reason: 'Annulation colis',
        p_reference_id: shipmentId,
        p_reference_type: 'shipment',
        p_movement_type: 'restock',
      })
      count++
    } catch (e) {
      console.error(`[Stock] restock error sku ${it.sku_id} shipment ${shipmentId}:`, e)
    }
  }

  return { restocked: true, count }
}

/**
 * Process stock consumption for all items in a shipment (idempotent per shipment).
 */
export async function consumeStockForShipment(
  tenantId: string,
  shipmentId: string,
): Promise<{ consumed: boolean; count: number }> {
  return consumeShipmentStockOnce(tenantId, shipmentId)
}
