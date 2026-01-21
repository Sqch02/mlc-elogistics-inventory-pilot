import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { fetchAllParcels, fetchAllReturns } from '@/lib/sendcloud/client'
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

      // STRATEGY: Two fetches to capture both updates AND new parcels
      let allParcels: ParsedShipment[] = []

      // Fetch 1: Get parcels updated since last sync (for status tracking)
      console.log(`\n[Cron] --- FETCH 1: Updated parcels (since: ${since || 'N/A'}) ---`)
      if (since) {
        const updatedParcels = await fetchAllParcels(credentials, since, 10)
        console.log(`[Cron] Fetch 1 returned: ${updatedParcels.length} parcels`)
        if (updatedParcels.length > 0) {
          console.log(`[Cron] Fetch 1 first parcel: ID=${updatedParcels[0].sendcloud_id}, ref=${updatedParcels[0].order_ref}, created=${updatedParcels[0].date_created}`)
          console.log(`[Cron] Fetch 1 last parcel: ID=${updatedParcels[updatedParcels.length-1].sendcloud_id}, ref=${updatedParcels[updatedParcels.length-1].order_ref}`)
        }
        allParcels.push(...updatedParcels)
      } else {
        console.log(`[Cron] Fetch 1 SKIPPED (no previous sync cursor)`)
      }

      // Fetch 2: Get recent parcels WITHOUT date filter (to catch new creations)
      console.log(`\n[Cron] --- FETCH 2: Recent parcels (NO date filter, 5 pages) ---`)
      const recentParcels = await fetchAllParcels(credentials, undefined, 5)
      console.log(`[Cron] Fetch 2 returned: ${recentParcels.length} parcels`)
      if (recentParcels.length > 0) {
        // Sort by date_created to see newest
        const sorted = [...recentParcels].sort((a, b) =>
          new Date(b.date_created || '').getTime() - new Date(a.date_created || '').getTime()
        )
        console.log(`[Cron] Fetch 2 NEWEST parcel: ID=${sorted[0].sendcloud_id}, ref=${sorted[0].order_ref}, created=${sorted[0].date_created}`)
        console.log(`[Cron] Fetch 2 OLDEST parcel: ID=${sorted[sorted.length-1].sendcloud_id}, ref=${sorted[sorted.length-1].order_ref}, created=${sorted[sorted.length-1].date_created}`)

        // Log all parcels created today
        const today = new Date().toISOString().split('T')[0]
        const todayParcels = sorted.filter(p => p.date_created?.startsWith(today))
        console.log(`[Cron] Parcels created TODAY (${today}): ${todayParcels.length}`)
        todayParcels.slice(0, 10).forEach(p => {
          console.log(`[Cron]   - ID=${p.sendcloud_id}, ref=${p.order_ref}, created=${p.date_created}`)
        })
      }

      // Merge and deduplicate by sendcloud_id
      const parcelMap = new Map<string, ParsedShipment>()
      for (const p of allParcels) {
        parcelMap.set(p.sendcloud_id, p)
      }
      for (const p of recentParcels) {
        parcelMap.set(p.sendcloud_id, p)
      }
      const parcels = Array.from(parcelMap.values())

      console.log(`\n[Cron] After deduplication: ${parcels.length} unique parcels to process`)

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
