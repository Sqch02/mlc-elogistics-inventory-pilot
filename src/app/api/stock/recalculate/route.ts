import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant, requireRole } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'
import { consumeShipmentStockOnce } from '@/lib/stock/consume'
import { isConsumableStatus } from '@/lib/stock/consumable-status'

interface ShipmentCandidate {
  id: string
  status_id: number | null
  status_message: string | null
  is_return: boolean | null
}

const RECALCULATE_LIMIT = 200

/**
 * POST /api/stock/recalculate
 *
 * Re-drives a bounded batch of consumable shipments whose central
 * stock_consumed_at marker is still NULL.
 */
export async function POST() {
  try {
    await requireRole(['super_admin', 'admin', 'ops'])
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()

    console.log('[Recalculate] Starting stock recalculation for tenant:', tenantId)

    // Bounded legacy catch-up. The central RPC owns bundle decomposition,
    // movement logging, the consumability backstop and stock_consumed_at CAS.
    const { data: candidateRows, error: queryError } = await adminClient
      .from('shipments')
      .select('id, status_id, status_message, is_return')
      .eq('tenant_id', tenantId)
      .is('stock_consumed_at', null)
      .order('shipped_at', { ascending: false })
      .limit(RECALCULATE_LIMIT)

    if (queryError) {
      console.error('[Recalculate] Query error:', queryError)
      throw new Error(`Failed to fetch shipments: ${queryError.message}`)
    }

    const candidates = ((candidateRows ?? []) as ShipmentCandidate[])
      .filter(isConsumableStatus)
    console.log('[Recalculate] Found', candidates.length, 'consumable shipments')

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucune expédition consommable à traiter',
        stats: { processed: 0, skipped: 0, errors: 0 },
      })
    }

    const candidateIds = candidates.map((shipment) => shipment.id)
    const { data: mappedRows, error: mappedError } = await adminClient
      .from('shipment_items')
      .select('shipment_id')
      .eq('tenant_id', tenantId)
      .in('shipment_id', candidateIds)
    if (mappedError) throw new Error(`Failed to fetch shipment_items: ${mappedError.message}`)
    const shipmentsWithItems = new Set(
      (mappedRows ?? []).map((row: { shipment_id: string }) => row.shipment_id),
    )

    const stats = {
      total: candidates.length,
      processed: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [] as string[],
    }

    for (const shipment of candidates) {
      if (!shipmentsWithItems.has(shipment.id)) {
        stats.skipped++
        continue
      }

      try {
        const { consumed } = await consumeShipmentStockOnce(tenantId, shipment.id)
        if (consumed) stats.processed++
        else stats.skipped++

        // Log progress every 100 items
        if (stats.processed % 100 === 0) {
          console.log(`[Recalculate] Progress: ${stats.processed} processed, ${stats.skipped} skipped`)
        }
      } catch (error) {
        stats.errors++
        const msg = `Expédition ${shipment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (stats.errorMessages.length < 10) {
          stats.errorMessages.push(msg)
        }
        console.error(`[Recalculate] Error:`, msg)
      }
    }

    console.log('[Recalculate] Completed:', stats)

    return NextResponse.json({
      success: true,
      message: `Recalcul terminé: ${stats.processed} expéditions traitées, ${stats.skipped} ignorées, ${stats.errors} erreurs`,
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
