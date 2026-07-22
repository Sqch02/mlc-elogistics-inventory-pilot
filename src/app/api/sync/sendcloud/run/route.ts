import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'
import { fetchAllParcels } from '@/lib/sendcloud/client'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'
import { consumeShipmentStockOnce } from '@/lib/stock/consume'
import { isConsumableStatus } from '@/lib/stock/consumable-status'
import type { PricingRule } from '@/lib/utils/pricing'
import { processShipmentItems } from '@/lib/utils/sku-mapping'
import { buildShipmentRow } from '@/lib/sendcloud/build-shipment-row'

export async function POST() {
  let syncRunId: string | null = null
  let tenantId: string

  try {
    tenantId = await requireTenant()
    console.log('[Sync] Starting sync for tenant:', tenantId)

    // Use admin client to bypass RLS for server-side sync
    const adminClient = getAdminDb()

    // Create sync_run record
    const { data: syncRun, error: syncRunError } = await adminClient
      .from('sync_runs')
      .insert({
        tenant_id: tenantId,
        source: 'sendcloud',
        status: 'running',
      })
      .select('id')
      .single()

    if (syncRunError || !syncRun) {
      throw new Error(`Failed to create sync run: ${syncRunError?.message}`)
    }

    syncRunId = syncRun.id

    // Get credentials (from tenant_settings or env vars)
    let credentials: SendcloudCredentials

    // Try to get tenant-specific credentials
    const { data: tenantSettings } = await adminClient
      .from('tenant_settings')
      .select('sendcloud_api_key, sendcloud_secret')
      .eq('tenant_id', tenantId)
      .single()

    if (tenantSettings?.sendcloud_api_key && tenantSettings?.sendcloud_secret) {
      credentials = {
        apiKey: tenantSettings.sendcloud_api_key,
        secret: tenantSettings.sendcloud_secret,
      }
    } else {
      // Fallback to environment variables
      const apiKey = process.env.SENDCLOUD_API_KEY
      const secret = process.env.SENDCLOUD_SECRET
      if (!apiKey || !secret) {
        return NextResponse.json({ error: 'Sendcloud credentials not configured' }, { status: 500 })
      }
      credentials = {
        apiKey,
        secret,
      }
    }

    // Get last successful sync cursor
    const { data: lastSync } = await adminClient
      .from('sync_runs')
      .select('cursor, ended_at')
      .eq('tenant_id', tenantId)
      .eq('source', 'sendcloud')
      .in('status', ['success', 'partial'])
      .order('ended_at', { ascending: false })
      .limit(1)
      .single()

    const since = lastSync?.cursor || lastSync?.ended_at || undefined

    // Fetch parcels from Sendcloud
    console.log('[Sync] Fetching parcels from Sendcloud, since:', since)
    const parcels = await fetchAllParcels(credentials, since)
    console.log('[Sync] Fetched', parcels.length, 'parcels')

    const stats = {
      fetched: parcels.length,
      created: 0,
      updated: 0,
      skipped: 0,
      itemsCreated: 0,
      stockConsumed: 0,
      errors: [] as string[],
      totalExpected: parcels.length,
      phase: 'processing' as string,
    }

    // Save initial stats with total expected
    await adminClient
      .from('sync_runs')
      .update({ stats_json: stats })
      .eq('id', syncRunId)

    // Item matching is delegated to the shared processShipmentItems pipeline
    // (RPC map_shipment_item, keyword layers 1-3, unmapped_items table) so the
    // manual sync maps exactly like cron and webhook. No local skuMap/descMap.

    // Get pricing rules for cost calculation
    const { data: pricingRules } = await adminClient
      .from('pricing_rules')
      .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
      .eq('tenant_id', tenantId)
      .order('weight_min_grams', { ascending: true })

    // Process each parcel
    for (const parcel of parcels) {
      try {
        // Scope existence and the consumption marker to this tenant. Existence
        // is only used for stats; stock eligibility is transition-based.
        const { data: existingShipment } = await adminClient
          .from('shipments')
          .select('id, stock_consumed_at')
          .eq('tenant_id', tenantId)
          .eq('sendcloud_id', parcel.sendcloud_id)
          .single()

        const isNewShipment = !existingShipment

        // Upsert shipment with all Sendcloud fields
        const { data: shipment, error: shipmentError } = await adminClient
          .from('shipments')
          .upsert(
            buildShipmentRow(tenantId, parcel, pricingRules as PricingRule[] | null),
            { onConflict: 'tenant_id,sendcloud_id' }
          )
          .select('id')
          .single()

        if (shipmentError) {
          console.log('[Sync] Error upserting shipment', parcel.sendcloud_id, ':', shipmentError.message)
          stats.errors.push(`Shipment ${parcel.sendcloud_id}: ${shipmentError.message}`)
          continue
        }

        if (isNewShipment) {
          stats.created++
        } else {
          stats.updated++
        }

        // Update progress every 50 shipments
        if ((stats.created + stats.updated) % 50 === 0) {
          console.log('[Sync] Progress:', stats.created + stats.updated, '/', stats.totalExpected, 'shipments')
          await adminClient
            .from('sync_runs')
            .update({ stats_json: stats })
            .eq('id', syncRunId)
        }

        // Process items via the shared mapping pipeline (same as cron/webhook):
        // keyword matching layers 1-3 + unmapped rows written to the
        // unmapped_items TABLE read by /mapping (not the legacy shipments column).
        if (shipment) {
          const rawJson = parcel.raw_json as Record<string, unknown>
          const parcelItems = (rawJson?.parcel_items as unknown[]) || []

          try {
            const { mappedCount } = await processShipmentItems(
              adminClient,
              tenantId,
              shipment.id,
              parcelItems,
            )
            stats.itemsCreated += mappedCount

            // Consume on the first consumable observation, including an
            // existing On-Hold shipment transitioning to Fulfilled/Completed.
            if (
              isConsumableStatus(parcel) &&
              existingShipment?.stock_consumed_at == null &&
              mappedCount > 0
            ) {
              try {
                const { count } = await consumeShipmentStockOnce(tenantId, shipment.id)
                stats.stockConsumed += count
              } catch (stockError) {
                console.error(`[Sync] Error consuming stock for shipment ${parcel.sendcloud_id}:`, stockError)
              }
            }
          } catch (err) {
            console.error(`[Sync] processShipmentItems error for parcel ${parcel.sendcloud_id}:`, err)
          }
        }
      } catch (error) {
        stats.errors.push(
          `Parcel ${parcel.sendcloud_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    // Update sync_run with results
    const newCursor = new Date().toISOString()
    await adminClient
      .from('sync_runs')
      .update({
        ended_at: new Date().toISOString(),
        status: stats.errors.length > 0 ? 'partial' : 'success',
        stats_json: stats,
        cursor: newCursor,
      })
      .eq('id', syncRunId)

    console.log('[Sync] Completed! Stats:', JSON.stringify(stats))
    return NextResponse.json({
      success: true,
      message: `Sync terminee: ${stats.created} expéditions importées`,
      stats,
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Sendcloud sync error:', error)

    // Update sync_run with error if we have an ID
    if (syncRunId) {
      const adminClient = getAdminDb()
      await adminClient
        .from('sync_runs')
        .update({
          ended_at: new Date().toISOString(),
          status: 'failed',
          error_text: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', syncRunId)
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de synchronisation',
      },
      { status: 500 }
    )
  }
}
