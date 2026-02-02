import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { fetchAllParcels } from '@/lib/sendcloud/client'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'
import { consumeStock } from '@/lib/stock/consume'
import { getDestination } from '@/lib/utils/pricing'

interface PricingRule {
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

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
      credentials = {
        apiKey: process.env.SENDCLOUD_API_KEY || '',
        secret: process.env.SENDCLOUD_SECRET || '',
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

    // Get all SKUs for item matching
    const { data: skus } = await adminClient
      .from('skus')
      .select('id, sku_code')
      .eq('tenant_id', tenantId)

    const skuMap = new Map<string, string>(skus?.map((s: { sku_code: string; id: string }) => [s.sku_code.toLowerCase(), s.id]) || [])

    // Get pricing rules for cost calculation
    const { data: pricingRules } = await adminClient
      .from('pricing_rules')
      .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
      .eq('tenant_id', tenantId)

    // Process each parcel
    for (const parcel of parcels) {
      try {
        // Check if shipment already exists (to know if we should consume stock)
        const { data: existingShipment } = await adminClient
          .from('shipments')
          .select('id')
          .eq('sendcloud_id', parcel.sendcloud_id)
          .single()

        const isNewShipment = !existingShipment

        // Calculate pricing with destination awareness
        let pricingStatus: 'ok' | 'missing' = 'missing'
        let computedCost: number | null = null

        if (pricingRules) {
          const destination = getDestination(parcel.country_code, parcel.carrier, parcel.service_point_id)
          const matchingRule = (pricingRules as PricingRule[]).find(
            (rule: PricingRule) =>
              rule.carrier.toLowerCase() === parcel.carrier.toLowerCase() &&
              rule.destination === destination &&
              rule.weight_min_grams <= parcel.weight_grams &&
              rule.weight_max_grams > parcel.weight_grams
          )

          if (matchingRule) {
            pricingStatus = 'ok'
            computedCost = Number(matchingRule.price_eur)
          }
        }

        // Upsert shipment with all Sendcloud fields
        const { data: shipment, error: shipmentError } = await adminClient
          .from('shipments')
          .upsert(
            {
              tenant_id: tenantId,
              sendcloud_id: parcel.sendcloud_id,
              shipped_at: parcel.shipped_at,
              carrier: parcel.carrier,
              service: parcel.service,
              weight_grams: parcel.weight_grams,
              order_ref: parcel.order_ref,
              tracking: parcel.tracking,
              pricing_status: pricingStatus,
              computed_cost_eur: computedCost,
              raw_json: parcel.raw_json,
              // New Sendcloud fields
              recipient_name: parcel.recipient_name,
              recipient_email: parcel.recipient_email,
              recipient_phone: parcel.recipient_phone,
              recipient_company: parcel.recipient_company,
              address_line1: parcel.address_line1,
              address_line2: parcel.address_line2,
              house_number: parcel.house_number,
              city: parcel.city,
              postal_code: parcel.postal_code,
              country_code: parcel.country_code,
              country_name: parcel.country_name,
              status_id: parcel.status_id,
              status_message: parcel.status_message,
              tracking_url: parcel.tracking_url,
              label_url: parcel.label_url,
              total_value: parcel.total_value,
              currency: parcel.currency,
              service_point_id: parcel.service_point_id,
              is_return: parcel.is_return,
              collo_count: parcel.collo_count,
              length_cm: parcel.length_cm,
              width_cm: parcel.width_cm,
              height_cm: parcel.height_cm,
              external_order_id: parcel.external_order_id,
              date_created: parcel.date_created,
              date_updated: parcel.date_updated,
              date_announced: parcel.date_announced,
              // Error detection fields
              has_error: parcel.has_error,
              error_message: parcel.error_message,
            },
            { onConflict: 'sendcloud_id' }
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

        // Process items if available
        if (parcel.items && parcel.items.length > 0 && shipment) {
          for (const item of parcel.items) {
            const skuId = skuMap.get(item.sku_code.toLowerCase())
            if (skuId) {
              const { error: itemError } = await adminClient
                .from('shipment_items')
                .upsert(
                  {
                    tenant_id: tenantId,
                    shipment_id: shipment.id,
                    sku_id: skuId,
                    qty: item.qty,
                  },
                  { onConflict: 'shipment_id,sku_id' }
                )

              if (!itemError) {
                stats.itemsCreated++

                // ONLY consume stock for NEW shipments (not updates)
                if (isNewShipment) {
                  try {
                    const consumeResults = await consumeStock(
                      tenantId,
                      skuId,
                      item.qty,
                      shipment.id,
                      'shipment'
                    )
                    stats.stockConsumed += consumeResults.length
                  } catch (stockError) {
                    console.error(`[Sync] Error consuming stock for SKU ${item.sku_code}:`, stockError)
                  }
                }
              }
            }
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
