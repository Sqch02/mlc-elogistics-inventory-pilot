import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
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

    // Create a Set of processed combinations for quick lookup
    const processedSet = new Set(
      existingMovements?.map((m: { reference_id: string | null; sku_id: string }) =>
        `${m.reference_id || ''}:${m.sku_id}`
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
      const key = `${item.shipment_id}:${item.sku_id}`

      // Skip if already processed
      if (processedSet.has(key)) {
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
    console.error('[Recalculate] Fatal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
