import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { consumeStock } from '@/lib/stock/consume'

interface ShipmentItemRow {
  shipment_id: string
  sku_id: string
  qty: number
  sku_code: string
  sendcloud_id: string
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

    // Get all shipment_items that don't have a corresponding stock_movement
    // We check by shipment_id (reference_id) + sku_id combination
    const { data: unprocessedItems, error: queryError } = await adminClient
      .from('shipment_items')
      .select(`
        shipment_id,
        sku_id,
        qty,
        skus!inner(sku_code),
        shipments!inner(sendcloud_id)
      `)
      .eq('tenant_id', tenantId)

    if (queryError) {
      throw new Error(`Failed to fetch shipment_items: ${queryError.message}`)
    }

    if (!unprocessedItems || unprocessedItems.length === 0) {
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

    // Create a Set of processed combinations for quick lookup
    const processedSet = new Set(
      existingMovements?.map((m: { reference_id: string; sku_id: string }) =>
        `${m.reference_id}:${m.sku_id}`
      ) || []
    )

    const stats = {
      total: unprocessedItems.length,
      processed: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [] as string[],
    }

    // Process each unprocessed item
    for (const item of unprocessedItems) {
      const typedItem = item as unknown as {
        shipment_id: string
        sku_id: string
        qty: number
        skus: { sku_code: string }
        shipments: { sendcloud_id: string }
      }

      const key = `${typedItem.shipment_id}:${typedItem.sku_id}`

      // Skip if already processed
      if (processedSet.has(key)) {
        stats.skipped++
        continue
      }

      try {
        // Consume stock for this item
        await consumeStock(
          tenantId,
          typedItem.sku_id,
          typedItem.qty,
          typedItem.shipment_id,
          'shipment'
        )

        stats.processed++
        console.log(`[Recalculate] Processed ${typedItem.skus.sku_code} x${typedItem.qty} for shipment ${typedItem.shipments.sendcloud_id}`)
      } catch (error) {
        stats.errors++
        const msg = `SKU ${typedItem.skus.sku_code}: ${error instanceof Error ? error.message : 'Unknown error'}`
        stats.errorMessages.push(msg)
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
