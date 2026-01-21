import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { fetchAllParcels, fetchAllReturns, fetchAllIntegrationShipments } from '@/lib/sendcloud/client'
import type { SendcloudCredentials, ParsedShipment } from '@/lib/sendcloud/types'
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
  console.log('========================================')
  console.log('[Cron] *** SYNC STARTED ***')
  console.log(`[Cron] Timestamp: ${new Date().toISOString()}`)
  console.log('========================================')

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

  console.log(`[Cron] Found ${tenants.length} tenants`)

  const results: Array<{ tenantId: string; success: boolean; count?: number; returnsCount?: number; error?: string; debug?: unknown }> = []

  for (const tenant of tenants) {
    try {
      console.log(`\n[Cron] ======= TENANT: ${tenant.id} =======`)

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
      let credSource = 'env'
      if (tenantSettings?.sendcloud_api_key && tenantSettings?.sendcloud_secret) {
        credentials = {
          apiKey: tenantSettings.sendcloud_api_key,
          secret: tenantSettings.sendcloud_secret,
        }
        credSource = 'tenant_settings'
      } else {
        credentials = {
          apiKey: process.env.SENDCLOUD_API_KEY || '',
          secret: process.env.SENDCLOUD_SECRET || '',
        }
      }

      console.log(`[Cron] Credentials source: ${credSource}`)
      console.log(`[Cron] API Key present: ${!!credentials.apiKey}`)
      console.log(`[Cron] Secret present: ${!!credentials.secret}`)

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

      console.log(`[Cron] Last sync cursor: ${lastSync?.cursor || 'NULL'}`)
      console.log(`[Cron] Last sync ended_at: ${lastSync?.ended_at || 'NULL'}`)
      console.log(`[Cron] Using 'since' value: ${since || 'NONE (full fetch)'}`)

      // STRATEGY: Fetch BOTH parcels (shipped) AND integration shipments (pending/on hold)

      // 1. Fetch parcels (orders with labels generated)
      console.log(`[Cron] Fetching parcels...`)
      const parcelsUpdated = since ? await fetchAllParcels(credentials, since, 10) : []
      const parcelsRecent = await fetchAllParcels(credentials, undefined, 5)
      console.log(`[Cron] Parcels: ${parcelsUpdated.length} updated + ${parcelsRecent.length} recent`)

      // 2. Fetch integration shipments (pending orders "On Hold")
      console.log(`[Cron] Fetching integration shipments (pending orders)...`)
      const pendingOrders = await fetchAllIntegrationShipments(credentials, 5)
      console.log(`[Cron] Pending orders from integrations: ${pendingOrders.length}`)

      // Merge all: parcels take priority over pending orders (same order_ref)
      // Use order_ref as key to avoid duplicates when order becomes parcel
      const shipmentMap = new Map<string, ParsedShipment>()

      // First add pending orders (lower priority)
      for (const p of pendingOrders) {
        if (p.order_ref) {
          shipmentMap.set(p.order_ref, p)
        }
      }

      // Then add parcels (higher priority - overwrites pending if same order_ref)
      for (const p of [...parcelsUpdated, ...parcelsRecent]) {
        if (p.order_ref) {
          shipmentMap.set(p.order_ref, p)
        } else {
          // Parcels without order_ref use sendcloud_id
          shipmentMap.set(p.sendcloud_id, p)
        }
      }

      const parcels = Array.from(shipmentMap.values())
      console.log(`[Cron] Total unique shipments to process: ${parcels.length}`)

      let created = 0
      let newShipments = 0
      let updatedShipments = 0
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
      console.log(`\n[Cron] --- PROCESSING ${parcels.length} PARCELS ---`)
      for (const parcel of parcels) {
        try {
          // Check if shipment already exists by sendcloud_id OR order_ref
          // This handles the case where an "On Hold" order becomes a parcel (ID changes)
          let existingShipment = null
          let existingByOrderRef = null

          // First check by sendcloud_id
          const { data: bySendcloudId } = await adminClient
            .from('shipments')
            .select('id, sendcloud_id')
            .eq('sendcloud_id', parcel.sendcloud_id)
            .single()

          existingShipment = bySendcloudId

          // If not found and we have order_ref, check by order_ref
          if (!existingShipment && parcel.order_ref) {
            const { data: byOrderRef } = await adminClient
              .from('shipments')
              .select('id, sendcloud_id')
              .eq('order_ref', parcel.order_ref)
              .eq('tenant_id', tenant.id)
              .single()

            existingByOrderRef = byOrderRef

            // If found by order_ref with different sendcloud_id, delete the old one
            // This happens when "On Hold" order (UUID) becomes parcel (numeric ID)
            if (existingByOrderRef && existingByOrderRef.sendcloud_id !== parcel.sendcloud_id) {
              console.log(`[Cron] Upgrading order ${parcel.order_ref}: ${existingByOrderRef.sendcloud_id} -> ${parcel.sendcloud_id}`)
              await adminClient
                .from('shipments')
                .delete()
                .eq('id', existingByOrderRef.id)
              existingByOrderRef = null // Treat as new since we deleted the old one
            }
          }

          const isNewShipment = !existingShipment && !existingByOrderRef

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
            console.error(`[Cron] ERROR upserting ${parcel.sendcloud_id}: ${shipmentError.message}`)
            errors.push(`${parcel.sendcloud_id}: ${shipmentError.message}`)
            continue
          }

          created++
          if (isNewShipment) {
            newShipments++
            console.log(`[Cron] NEW shipment: ID=${parcel.sendcloud_id}, ref=${parcel.order_ref}, created=${parcel.date_created}`)
          } else {
            updatedShipments++
          }

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

      console.log(`\n[Cron] --- PROCESSING COMPLETE ---`)
      console.log(`[Cron] Total processed: ${created}`)
      console.log(`[Cron] NEW shipments: ${newShipments}`)
      console.log(`[Cron] UPDATED shipments: ${updatedShipments}`)
      console.log(`[Cron] Errors: ${errors.length}`)

      // Update sync_run
      await adminClient
        .from('sync_runs')
        .update({
          ended_at: new Date().toISOString(),
          status: errors.length > 0 ? 'partial' : 'success',
          stats_json: {
            fetched: parcels.length,
            created,
            newShipments,
            updatedShipments,
            errors
          },
          cursor: new Date().toISOString(),
        })
        .eq('id', syncRun.id)

      // =============================================
      // SYNC RETURNS
      // =============================================
      let returnsCreated = 0
      const returnsErrors: string[] = []

      try {
        // Get last returns sync cursor
        const { data: lastReturnsSync } = await adminClient
          .from('sync_runs')
          .select('cursor, ended_at')
          .eq('tenant_id', tenant.id)
          .eq('source', 'sendcloud_returns')
          .in('status', ['success', 'partial'])
          .order('ended_at', { ascending: false })
          .limit(1)
          .single()

        const returnsSince = lastReturnsSync?.cursor || lastReturnsSync?.ended_at || undefined

        // Fetch returns
        const maxReturnsPages = returnsSince ? 10 : 50
        const returns = await fetchAllReturns(credentials, returnsSince, maxReturnsPages)
        console.log(`[Cron] Fetched ${returns.length} returns for tenant ${tenant.id}`)

        // Process each return
        for (const ret of returns) {
          try {
            await adminClient
              .from('returns')
              .upsert(
                {
                  tenant_id: tenant.id,
                  sendcloud_id: ret.sendcloud_id,
                  sendcloud_return_id: ret.sendcloud_return_id,
                  order_ref: ret.order_ref,
                  tracking_number: ret.tracking_number,
                  tracking_url: ret.tracking_url,
                  carrier: ret.carrier,
                  service: ret.service,
                  status: ret.status,
                  status_message: ret.status_message,
                  sender_name: ret.sender_name,
                  sender_email: ret.sender_email,
                  sender_phone: ret.sender_phone,
                  sender_company: ret.sender_company,
                  sender_address: ret.sender_address,
                  sender_city: ret.sender_city,
                  sender_postal_code: ret.sender_postal_code,
                  sender_country_code: ret.sender_country_code,
                  return_reason: ret.return_reason,
                  return_reason_comment: ret.return_reason_comment,
                  created_at: ret.created_at,
                  announced_at: ret.announced_at,
                  raw_json: ret.raw_json,
                },
                { onConflict: 'sendcloud_return_id' }
              )

            returnsCreated++
          } catch (error) {
            returnsErrors.push(`Return ${ret.sendcloud_return_id}: ${error instanceof Error ? error.message : 'Unknown'}`)
          }
        }

        // Create returns sync_run record
        await adminClient
          .from('sync_runs')
          .insert({
            tenant_id: tenant.id,
            source: 'sendcloud_returns',
            status: returnsErrors.length > 0 ? 'partial' : 'success',
            ended_at: new Date().toISOString(),
            stats_json: { fetched: returns.length, created: returnsCreated, errors: returnsErrors },
            cursor: new Date().toISOString(),
          })

        console.log(`[Cron] Returns synced: ${returnsCreated}`)
      } catch (returnsSyncError) {
        console.error(`[Cron] Error syncing returns for tenant ${tenant.id}:`, returnsSyncError)
      }

      results.push({
        tenantId: tenant.id,
        success: true,
        count: created,
        returnsCount: returnsCreated,
        debug: {
          newShipments,
          updatedShipments,
          totalFetched: parcels.length
        }
      })
      console.log(`\n[Cron] ======= TENANT ${tenant.id} COMPLETE =======`)
      console.log(`[Cron] Shipments: ${newShipments} new, ${updatedShipments} updated`)
    } catch (error) {
      console.error(`[Cron] Error syncing tenant ${tenant.id}:`, error)
      results.push({
        tenantId: tenant.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  console.log('\n========================================')
  console.log('[Cron] *** SYNC COMPLETE ***')
  console.log(`[Cron] Results: ${JSON.stringify(results)}`)
  console.log('========================================')

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  })
}
