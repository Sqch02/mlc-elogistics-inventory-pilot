import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant, requireRole } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'
import { consumeStock } from '@/lib/stock/consume'

interface ShipmentItemRow {
  shipment_id: string
  sku_id: string
  qty: number
}

/**
 * POST /api/stock/recalculate
 *
 * Recalculates stock by processing all shipment_items that don't have
 * corresponding stock_movements. This is useful to "catch up" on historical
 * shipments that were synced before stock consumption was implemented.
 */
export async function POST() {
  try {
    await requireRole(['super_admin', 'admin', 'ops'])
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()

    console.log('[Recalculate] Starting stock recalculation for tenant:', tenantId)

    // Get all shipment_items (simple query without joins to avoid issues)
    const { data: allItems, error: queryError } = await adminClient
      .from('shipment_items')
      .select('shipment_id, sku_id, qty')
      .eq('tenant_id', tenantId)

    if (queryError) {
      console.error('[Recalculate] Query error:', queryError)
      throw new Error(`Failed to fetch shipment_items: ${queryError.message}`)
    }

    console.log('[Recalculate] Found', allItems?.length || 0, 'shipment_items')

    if (!allItems || allItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun article à traiter',
        stats: { processed: 0, skipped: 0, errors: 0 },
      })
    }

    // Get existing stock_movements to know which items are already processed
    const { data: existingMovements } = await adminClient
      .from('stock_movements')
      .select('reference_id, sku_id')
      .eq('tenant_id', tenantId)
      .eq('reference_type', 'shipment')

    console.log('[Recalculate] Found', existingMovements?.length || 0, 'existing movements')

    // Dedup at the SHIPMENT level: a shipment that already has ANY stock_movement
    // has been consumed. Keying by `shipment_id:sku_id` is wrong for bundles -
    // apply_stock_delta logs movements for the bundle's COMPONENTS, never for the
    // bundle sku_id itself - so a bundle item never matched and was re-consumed
    // (its components double-decremented) on every run.
    const processedShipments = new Set(
      existingMovements?.map((m: { reference_id: string | null }) =>
        m.reference_id || ''
      ) || []
    )

    const stats = {
      total: allItems.length,
      processed: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [] as string[],
    }

    // Process each item
    for (const item of allItems as ShipmentItemRow[]) {
      // Skip if this shipment already has stock_movements (already consumed).
      if (processedShipments.has(item.shipment_id)) {
        stats.skipped++
        continue
      }

      try {
        // Consume stock for this item
        await consumeStock(
          tenantId,
          item.sku_id,
          item.qty,
          item.shipment_id,
          'shipment'
        )

        stats.processed++

        // Log progress every 100 items
        if (stats.processed % 100 === 0) {
          console.log(`[Recalculate] Progress: ${stats.processed} processed, ${stats.skipped} skipped`)
        }
      } catch (error) {
        stats.errors++
        const msg = `SKU ${item.sku_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (stats.errorMessages.length < 10) {
          stats.errorMessages.push(msg)
        }
        console.error(`[Recalculate] Error:`, msg)
      }
    }

    console.log('[Recalculate] Completed:', stats)

    return NextResponse.json({
      success: true,
      message: `Recalcul terminé: ${stats.processed} articles traités, ${stats.skipped} déjà traités, ${stats.errors} erreurs`,
      stats,
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('[Recalculate] Fatal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
