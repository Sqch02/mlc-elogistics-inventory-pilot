import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireRole } from '@/lib/supabase/auth'
import { getFastTenantId } from '@/lib/supabase/fast-auth'

/**
 * POST /api/stock/backfill-items
 *
 * Reprocesses shipments after the inventory date (Feb 17 2026) that have
 * raw_json parcel_items but no shipment_items. Uses sendcloud_sku_mappings
 * to match descriptions to SKUs and creates the missing shipment_items.
 *
 * Run /api/stock/recalculate after this to consume stock.
 */
export async function POST() {
  try {
    await requireRole(['super_admin', 'admin'])
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant non trouve' }, { status: 400 })
    }

    const db = getAdminDb()

    // Load description mappings
    const { data: mappings } = await db
      .from('sendcloud_sku_mappings')
      .select('description_pattern, sku_id')
      .eq('tenant_id', tenantId)

    const descMap = new Map<string, string>(
      mappings?.map((m: { description_pattern: string; sku_id: string }) =>
        [m.description_pattern.toLowerCase(), m.sku_id]
      ) || []
    )

    if (descMap.size === 0) {
      return NextResponse.json({
        error: 'Aucun mapping configure. Lancez le seed d\'abord.'
      }, { status: 400 })
    }

    // Also load SKU code map for direct matching
    const { data: skus } = await db
      .from('skus')
      .select('id, sku_code')
      .eq('tenant_id', tenantId)

    const skuMap = new Map<string, string>(
      skus?.map((s: { sku_code: string; id: string }) => [s.sku_code.toLowerCase(), s.id]) || []
    )

    // Get shipments after inventory date without shipment_items
    const INVENTORY_DATE = '2026-02-17T00:00:00Z'

    const { data: shipments } = await db
      .from('shipments')
      .select('id, raw_json, sendcloud_id')
      .eq('tenant_id', tenantId)
      .gte('shipped_at', INVENTORY_DATE)
      .not('raw_json', 'is', null)
      .eq('is_return', false)

    if (!shipments || shipments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucune expedition a traiter',
        stats: { total: 0, processed: 0, itemsCreated: 0, unmapped: 0, skipped: 0 }
      })
    }

    const stats = {
      total: shipments.length,
      processed: 0,
      itemsCreated: 0,
      unmapped: 0,
      skipped: 0,
      errors: 0,
    }

    for (const shipment of shipments) {
      const parcelItems = shipment.raw_json?.parcel_items
      if (!parcelItems || parcelItems.length === 0) {
        stats.skipped++
        continue
      }

      // Check if shipment already has items
      const { count } = await db
        .from('shipment_items')
        .select('*', { count: 'exact', head: true })
        .eq('shipment_id', shipment.id)

      if (count && count > 0) {
        stats.skipped++
        continue
      }

      const unmappedItems: Array<{ description: string; qty: number }> = []

      for (const item of parcelItems) {
        const skuCode = (item.sku || '').toLowerCase()
        const desc = (item.description || '').toLowerCase()

        // 1. Try direct SKU code match
        let skuId = skuCode ? skuMap.get(skuCode) : undefined

        // 2. Fallback: try description mapping
        if (!skuId && desc) {
          skuId = descMap.get(desc)
        }

        if (skuId) {
          const { error } = await db
            .from('shipment_items')
            .upsert(
              {
                tenant_id: tenantId,
                shipment_id: shipment.id,
                sku_id: skuId,
                qty: item.quantity || 1,
              },
              { onConflict: 'shipment_id,sku_id' }
            )

          if (!error) stats.itemsCreated++
        } else if (item.description) {
          unmappedItems.push({
            description: item.description,
            qty: item.quantity || 1,
          })
        }
      }

      if (unmappedItems.length > 0) {
        await db
          .from('shipments')
          .update({ unmapped_items: unmappedItems })
          .eq('id', shipment.id)
        stats.unmapped++
      }

      stats.processed++

      if (stats.processed % 200 === 0) {
        console.log(`[Backfill] Progress: ${stats.processed}/${stats.total}`)
      }
    }

    console.log('[Backfill] Done:', stats)

    return NextResponse.json({
      success: true,
      message: `Backfill termine: ${stats.itemsCreated} items crees, ${stats.unmapped} expeditions avec items non mappes`,
      stats,
    })
  } catch (error) {
    console.error('[Backfill] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
