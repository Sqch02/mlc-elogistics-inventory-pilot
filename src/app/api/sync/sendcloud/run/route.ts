import { NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'
import { fetchAllParcels } from '@/lib/sendcloud/client'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'

interface PricingRule {
  carrier: string
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

export async function POST() {
  let syncRunId: string | null = null
  let tenantId: string

  try {
    tenantId = await requireTenant()
    const user = await getCurrentUser()
    const supabase = await getServerDb()
    const adminClient = getAdminDb()

    // Create sync_run record
    const { data: syncRun, error: syncRunError } = await supabase
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
    const { data: lastSync } = await supabase
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
    const parcels = await fetchAllParcels(credentials, since)

    const stats = {
      fetched: parcels.length,
      created: 0,
      updated: 0,
      skipped: 0,
      itemsCreated: 0,
      errors: [] as string[],
    }

    // Get all SKUs for item matching
    const { data: skus } = await supabase
      .from('skus')
      .select('id, sku_code')
      .eq('tenant_id', tenantId)

    const skuMap = new Map(skus?.map((s: { sku_code: string; id: string }) => [s.sku_code.toLowerCase(), s.id]) || [])

    // Get pricing rules for cost calculation
    const { data: pricingRules } = await supabase
      .from('pricing_rules')
      .select('carrier, weight_min_grams, weight_max_grams, price_eur')
      .eq('tenant_id', tenantId)

    // Process each parcel
    for (const parcel of parcels) {
      try {
        // Calculate pricing
        let pricingStatus: 'ok' | 'missing' = 'missing'
        let computedCost: number | null = null

        if (pricingRules) {
          const matchingRule = (pricingRules as PricingRule[]).find(
            (rule: PricingRule) =>
              rule.carrier.toLowerCase() === parcel.carrier.toLowerCase() &&
              rule.weight_min_grams <= parcel.weight_grams &&
              rule.weight_max_grams > parcel.weight_grams
          )

          if (matchingRule) {
            pricingStatus = 'ok'
            computedCost = Number(matchingRule.price_eur)
          }
        }

        // Upsert shipment
        const { data: shipment, error: shipmentError } = await supabase
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
            },
            { onConflict: 'sendcloud_id' }
          )
          .select('id')
          .single()

        if (shipmentError) {
          stats.errors.push(`Shipment ${parcel.sendcloud_id}: ${shipmentError.message}`)
          continue
        }

        stats.created++

        // Process items if available
        if (parcel.items && parcel.items.length > 0 && shipment) {
          for (const item of parcel.items) {
            const skuId = skuMap.get(item.sku_code.toLowerCase())
            if (skuId) {
              const { error: itemError } = await supabase
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
    await supabase
      .from('sync_runs')
      .update({
        ended_at: new Date().toISOString(),
        status: stats.errors.length > 0 ? 'partial' : 'success',
        stats_json: stats,
        cursor: newCursor,
      })
      .eq('id', syncRunId)

    return NextResponse.json({
      success: true,
      message: `Sync terminee`,
      stats,
    })
  } catch (error) {
    console.error('Sendcloud sync error:', error)

    // Update sync_run with error if we have an ID
    if (syncRunId) {
      const supabase = await getServerDb()
      await supabase
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
