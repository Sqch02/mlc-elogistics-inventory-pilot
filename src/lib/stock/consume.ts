/**
 * Stock Consumption Logic
 * Handles decrementing stock for both simple SKUs and bundles
 */

import { getAdminDb } from '@/lib/supabase/untyped'

interface BundleComponent {
  component_sku_id: string
  qty_component: number
  skus: { sku_code: string } | null
}

interface StockConsumptionResult {
  sku_id: string
  sku_code: string
  qty_consumed: number
  qty_before: number
  qty_after: number
  is_bundle_component: boolean
  bundle_sku_code?: string
}

/**
 * Consume stock for a SKU (handles both simple SKUs and bundles)
 *
 * @param tenantId - Tenant ID
 * @param skuId - The SKU ID being shipped
 * @param qty - Quantity shipped
 * @param referenceId - Reference ID (shipment ID)
 * @param referenceType - Reference type (e.g., 'shipment')
 * @returns Array of stock consumption results
 */
export async function consumeStock(
  tenantId: string,
  skuId: string,
  qty: number,
  referenceId?: string,
  referenceType?: string
): Promise<StockConsumptionResult[]> {
  const adminClient = getAdminDb()
  const results: StockConsumptionResult[] = []

  // Get SKU info
  const { data: sku } = await adminClient
    .from('skus')
    .select('id, sku_code')
    .eq('id', skuId)
    .single()

  if (!sku) {
    console.warn(`[Stock] SKU ${skuId} not found`)
    return results
  }

  // Check if this SKU is a bundle
  const { data: bundle } = await adminClient
    .from('bundles')
    .select(`
      id,
      bundle_components(
        component_sku_id,
        qty_component,
        skus:component_sku_id(sku_code)
      )
    `)
    .eq('bundle_sku_id', skuId)
    .eq('tenant_id', tenantId)
    .single()

  if (bundle && bundle.bundle_components && (bundle.bundle_components as BundleComponent[]).length > 0) {
    // It's a bundle - consume each component
    console.log(`[Stock] ${sku.sku_code} is a bundle with ${(bundle.bundle_components as BundleComponent[]).length} components`)

    for (const component of bundle.bundle_components as BundleComponent[]) {
      const totalQty = component.qty_component * qty
      const componentResult = await decrementSkuStock(
        adminClient,
        tenantId,
        component.component_sku_id,
        totalQty,
        referenceId,
        referenceType,
        `Bundle ${sku.sku_code} x${qty}`
      )

      if (componentResult) {
        results.push({
          ...componentResult,
          is_bundle_component: true,
          bundle_sku_code: sku.sku_code,
        })
      }
    }
  } else {
    // Simple SKU - consume directly
    const result = await decrementSkuStock(
      adminClient,
      tenantId,
      skuId,
      qty,
      referenceId,
      referenceType,
      'Expédition'
    )

    if (result) {
      results.push({
        ...result,
        is_bundle_component: false,
      })
    }
  }

  return results
}

/**
 * Decrement stock for a single SKU
 */
async function decrementSkuStock(
  adminClient: ReturnType<typeof getAdminDb>,
  tenantId: string,
  skuId: string,
  qty: number,
  referenceId?: string,
  referenceType?: string,
  reason?: string
): Promise<Omit<StockConsumptionResult, 'is_bundle_component' | 'bundle_sku_code'> | null> {
  // Get SKU info
  const { data: sku } = await adminClient
    .from('skus')
    .select('sku_code')
    .eq('id', skuId)
    .single()

  if (!sku) {
    console.warn(`[Stock] Component SKU ${skuId} not found`)
    return null
  }

  // Get current stock
  const { data: currentStock } = await adminClient
    .from('stock_snapshots')
    .select('qty_current')
    .eq('sku_id', skuId)
    .single()

  const qtyBefore = currentStock?.qty_current || 0
  const qtyAfter = Math.max(0, qtyBefore - qty)

  // Update stock
  const { error: stockError } = await adminClient
    .from('stock_snapshots')
    .upsert({
      tenant_id: tenantId,
      sku_id: skuId,
      qty_current: qtyAfter,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'sku_id' })

  if (stockError) {
    console.error(`[Stock] Error updating stock for ${sku.sku_code}:`, stockError)
    return null
  }

  // Log movement
  await adminClient
    .from('stock_movements')
    .insert({
      tenant_id: tenantId,
      sku_id: skuId,
      qty_before: qtyBefore,
      qty_after: qtyAfter,
      adjustment: -qty,
      movement_type: 'shipment',
      reason: reason || 'Expédition',
      reference_id: referenceId || null,
      reference_type: referenceType || null,
    })

  console.log(`[Stock] ${sku.sku_code}: ${qtyBefore} → ${qtyAfter} (-${qty})`)

  return {
    sku_id: skuId,
    sku_code: sku.sku_code,
    qty_consumed: qty,
    qty_before: qtyBefore,
    qty_after: qtyAfter,
  }
}

/**
 * Process stock consumption for all items in a shipment
 */
export async function consumeStockForShipment(
  tenantId: string,
  shipmentId: string,
  items: Array<{ sku_id: string; qty: number }>
): Promise<StockConsumptionResult[]> {
  const allResults: StockConsumptionResult[] = []

  for (const item of items) {
    const results = await consumeStock(
      tenantId,
      item.sku_id,
      item.qty,
      shipmentId,
      'shipment'
    )
    allResults.push(...results)
  }

  return allResults
}
