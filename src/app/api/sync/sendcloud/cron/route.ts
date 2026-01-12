import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
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

// This endpoint is called by Vercel Cron every 15 minutes
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel adds this header)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Always require CRON_SECRET in production
  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.error('[Cron] CRON_SECRET not configured in production')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // Verify the secret if configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = getAdminDb()

  // Get all tenants
  const { data: tenants, error: tenantsError } = await adminClient
    .from('tenants')
    .select('id')

  if (tenantsError || !tenants) {
    console.error('[Cron] Failed to get tenants:', tenantsError)
    return NextResponse.json({ error: 'Failed to get tenants' }, { status: 500 })
  }

  const results: Array<{ tenantId: string; success: boolean; count?: number; error?: string }> = []

  for (const tenant of tenants) {
    try {
      console.log(`[Cron] Syncing tenant: ${tenant.id}`)

      // Create sync_run record
      const { data: syncRun, error: syncRunError } = await adminClient
        .from('sync_runs')
        .insert({
          tenant_id: tenant.id,
          source: 'sendcloud',
          status: 'running',
        })
        .select('id')
        .single()

      if (syncRunError || !syncRun) {
        throw new Error(`Failed to create sync run: ${syncRunError?.message}`)
      }

      // Get credentials from tenant_settings or env vars
      const { data: tenantSettings } = await adminClient
        .from('tenant_settings')
        .select('sendcloud_api_key, sendcloud_secret')
        .eq('tenant_id', tenant.id)
        .single()

      let credentials: SendcloudCredentials
      if (tenantSettings?.sendcloud_api_key && tenantSettings?.sendcloud_secret) {
        credentials = {
          apiKey: tenantSettings.sendcloud_api_key,
          secret: tenantSettings.sendcloud_secret,
        }
      } else {
        credentials = {
          apiKey: process.env.SENDCLOUD_API_KEY || '',
          secret: process.env.SENDCLOUD_SECRET || '',
        }
      }

      if (!credentials.apiKey || !credentials.secret) {
        throw new Error('No Sendcloud credentials configured')
      }

      // Get last sync cursor (only fetch new parcels)
      const { data: lastSync } = await adminClient
        .from('sync_runs')
        .select('cursor, ended_at')
        .eq('tenant_id', tenant.id)
        .eq('source', 'sendcloud')
        .in('status', ['success', 'partial'])
        .order('ended_at', { ascending: false })
        .limit(1)
        .single()

      const since = lastSync?.cursor || lastSync?.ended_at || undefined

      // Fetch parcels - use higher limit for full sync, lower for incremental
      // If no previous sync (since is undefined), fetch up to 50 pages (5000 parcels) for initial sync
      // Otherwise fetch 10 pages (1000) for incremental updates
      const maxPages = since ? 10 : 50
      const parcels = await fetchAllParcels(credentials, since, maxPages)
      console.log(`[Cron] Fetched ${parcels.length} new parcels for tenant ${tenant.id}`)

      let created = 0
      const errors: string[] = []

      // Get SKUs for item matching
      const { data: skus } = await adminClient
        .from('skus')
        .select('id, sku_code')
        .eq('tenant_id', tenant.id)

      const skuMap = new Map<string, string>(
        skus?.map((s: { sku_code: string; id: string }) => [s.sku_code.toLowerCase(), s.id]) || []
      )

      // Get pricing rules
      const { data: pricingRules } = await adminClient
        .from('pricing_rules')
        .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
        .eq('tenant_id', tenant.id)

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

          let pricingStatus: 'ok' | 'missing' = 'missing'
          let computedCost: number | null = null

          if (pricingRules) {
            const destination = getDestination(parcel.country_code, parcel.carrier, parcel.service_point_id)
            const matchingRule = (pricingRules as PricingRule[]).find(
              (rule) =>
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

          const { data: shipment, error: shipmentError } = await adminClient
            .from('shipments')
            .upsert(
              {
                tenant_id: tenant.id,
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
                // All Sendcloud fields
                recipient_name: parcel.recipient_name,
                recipient_email: parcel.recipient_email,
                recipient_phone: parcel.recipient_phone,
                recipient_company: parcel.recipient_company,
                address_line1: parcel.address_line1,
                address_line2: parcel.address_line2,
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
              },
              { onConflict: 'sendcloud_id' }
            )
            .select('id')
            .single()

          if (shipmentError) {
            errors.push(`${parcel.sendcloud_id}: ${shipmentError.message}`)
            continue
          }

          created++

          // Process items
          if (parcel.items && parcel.items.length > 0 && shipment) {
            for (const item of parcel.items) {
              const skuId = skuMap.get(item.sku_code.toLowerCase())
              if (skuId) {
                await adminClient.from('shipment_items').upsert(
                  {
                    tenant_id: tenant.id,
                    shipment_id: shipment.id,
                    sku_id: skuId,
                    qty: item.qty,
                  },
                  { onConflict: 'shipment_id,sku_id' }
                )

                // ONLY consume stock for NEW shipments (not updates)
                if (isNewShipment) {
                  try {
                    await consumeStock(
                      tenant.id,
                      skuId,
                      item.qty,
                      shipment.id,
                      'shipment'
                    )
                  } catch (stockError) {
                    console.error(`[Cron] Error consuming stock for SKU ${item.sku_code}:`, stockError)
                  }
                }
              }
            }
          }
        } catch (error) {
          errors.push(`${parcel.sendcloud_id}: ${error instanceof Error ? error.message : 'Unknown'}`)
        }
      }

      // Update sync_run
      await adminClient
        .from('sync_runs')
        .update({
          ended_at: new Date().toISOString(),
          status: errors.length > 0 ? 'partial' : 'success',
          stats_json: { fetched: parcels.length, created, errors },
          cursor: new Date().toISOString(),
        })
        .eq('id', syncRun.id)

      results.push({ tenantId: tenant.id, success: true, count: created })
      console.log(`[Cron] Tenant ${tenant.id}: ${created} shipments synced`)
    } catch (error) {
      console.error(`[Cron] Error syncing tenant ${tenant.id}:`, error)
      results.push({
        tenantId: tenant.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  })
}
