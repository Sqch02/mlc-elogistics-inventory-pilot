import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

interface ReversalRow {
  shipments_deleted: number
  skus_reversed: number
  units_reversed: number
}

export interface DuplicateReversalResult {
  shipmentsDeleted: number
  skusReversed: number
  unitsReversed: number
  usedFallback: boolean
}

async function reverseDuplicateShipmentStockLegacy(
  adminClient: AdminClient,
  tenantId: string,
  shipmentIds: string[],
): Promise<DuplicateReversalResult> {
  const { data: uuidMovements } = await adminClient
    .from('stock_movements')
    .select('sku_id, adjustment')
    .eq('tenant_id', tenantId)
    .eq('movement_type', 'shipment')
    .in('reference_id', shipmentIds)

  const reverseBySku = new Map<string, number>()
  for (const movement of uuidMovements ?? []) {
    reverseBySku.set(
      movement.sku_id,
      (reverseBySku.get(movement.sku_id) ?? 0) - movement.adjustment,
    )
  }

  let unitsReversed = 0
  for (const [skuId, delta] of reverseBySku) {
    const { error } = await adminClient.rpc('apply_stock_delta', {
      p_tenant_id: tenantId,
      p_sku_id: skuId,
      p_delta: delta,
      p_reason: 'Auto-reverse: doublon UUID/numeric Sendcloud, UUID supprimee',
      p_reference_id: undefined,
      p_reference_type: 'manual',
      p_user_id: undefined,
      p_movement_type: 'manual',
    })
    if (error) throw new Error(`Duplicate stock reversal failed: ${error.message}`)
    unitsReversed += delta
  }

  const { error: deleteError } = await adminClient
    .from('shipments')
    .delete()
    .eq('tenant_id', tenantId)
    .in('id', shipmentIds)
  if (deleteError) throw new Error(`Duplicate shipment delete failed: ${deleteError.message}`)

  return {
    shipmentsDeleted: shipmentIds.length,
    skusReversed: reverseBySku.size,
    unitsReversed,
    usedFallback: true,
  }
}

export async function reverseDuplicateShipmentStock(
  adminClient: AdminClient,
  tenantId: string,
  shipmentIds: string[],
): Promise<DuplicateReversalResult> {
  if (shipmentIds.length === 0) {
    return {
      shipmentsDeleted: 0,
      skusReversed: 0,
      unitsReversed: 0,
      usedFallback: false,
    }
  }

  try {
    const { data, error } = await adminClient.rpc(
      'reverse_duplicate_shipment_stock',
      {
        p_tenant_id: tenantId,
        p_shipment_ids: shipmentIds,
      },
    )

    const row: ReversalRow | null = Array.isArray(data) ? data[0] ?? null : null
    if (!error && row) {
      return {
        shipmentsDeleted: row.shipments_deleted,
        skusReversed: row.skus_reversed,
        unitsReversed: row.units_reversed,
        usedFallback: false,
      }
    }

    console.warn(
      '[Cron] duplicate reversal batch RPC unavailable; using safe fallback:',
      error?.message ?? 'empty result',
    )
  } catch (error) {
    console.warn(
      '[Cron] duplicate reversal batch RPC threw; using safe fallback:',
      error,
    )
  }

  // Deployment-order safety: cron remains operational before migration 00090.
  return reverseDuplicateShipmentStockLegacy(
    adminClient,
    tenantId,
    shipmentIds,
  )
}
