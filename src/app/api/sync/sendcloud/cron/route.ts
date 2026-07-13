import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { fetchAllParcels, fetchAllReturns, fetchAllIntegrationShipments } from '@/lib/sendcloud/client'
import type { SendcloudCredentials, ParsedShipment, ParsedReturn } from '@/lib/sendcloud/types'
import { getDestination } from '@/lib/utils/pricing'
import { processShipmentItems } from '@/lib/utils/sku-mapping'
import { consumeShipmentStockOnce } from '@/lib/stock/consume'
import { reconcileTenant } from '@/lib/sendcloud/reconcile'
import { getCronMaxPages } from '@/lib/sendcloud/pagination'

interface PricingRule {
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

export async function fetchCronData(
  credentials: SendcloudCredentials,
  since: string,
  maxPages: number,
) {
  return Promise.all([
    fetchAllParcels(credentials, since, maxPages),
    fetchAllIntegrationShipments(credentials, maxPages),
    fetchAllReturns(credentials, since, maxPages),
  ])
}

const ANALYTICS_REFRESH_RPCS = [
  'refresh_physical_items_view',
  'refresh_dashboard_daily',
  'refresh_sku_metrics',
] as const

export async function refreshCronAnalytics(
  adminClient: ReturnType<typeof getAdminDb>,
): Promise<{ refreshed: string[]; failed: string[] }> {
  const refreshed: string[] = []
  const failed: string[] = []

  // Keep the dependency order: SKU consumption metrics read from the physical
  // items view. Each RPC is isolated so a timeout cannot block later views.
  for (const rpcName of ANALYTICS_REFRESH_RPCS) {
    try {
      const { error } = await adminClient.rpc(rpcName)
      if (error) {
        failed.push(rpcName)
        console.error(`[Cron] ${rpcName} failed:`, error)
      } else {
        refreshed.push(rpcName)
        console.log(`[Cron] ${rpcName} completed`)
      }
    } catch (error) {
      failed.push(rpcName)
      console.error(`[Cron] ${rpcName} failed:`, error)
    }
  }

  return { refreshed, failed }
}

// Background sync function - runs after response is sent
async function runSync() {
  const startTime = Date.now()
  const maxPages = getCronMaxPages()
  console.log('========================================')
  console.log('[Cron] *** SYNC STARTED (BACKGROUND) ***')
  console.log(`[Cron] Timestamp: ${new Date().toISOString()}`)
  console.log('========================================')

  const adminClient = getAdminDb()

  const { data: tenants, error: tenantsError } = await adminClient
    .from('tenants')
    .select('id')

  if (tenantsError || !tenants) {
    console.error('[Cron] Failed to get tenants:', tenantsError)
    return
  }

  const results: Array<{ tenantId: string; success: boolean; shipments?: number; returns?: number; error?: string; skipped?: string }> = []

  for (const tenant of tenants) {
    // P0-cron: try to take an advisory lock per tenant. If a previous cron
    // tick is still running (jitter, retry, or a redeploy mid-sync), we skip
    // this tenant rather than running concurrently and double-consuming stock.
    const { data: lockAcquired } = await adminClient.rpc('try_cron_tenant_lock', {
      p_tenant_id: tenant.id,
    })
    if (lockAcquired === false) {
      console.warn(`[Cron] Skipping tenant ${tenant.id}: previous sync still holds the lock`)
      results.push({ tenantId: tenant.id, success: true, shipments: 0, returns: 0, skipped: 'lock_held' })
      continue
    }

    try {
      console.log(`\n[Cron] ======= TENANT: ${tenant.id} =======`)

      // Get credentials
      const { data: tenantSettings } = await adminClient
        .from('tenant_settings')
        .select('sendcloud_api_key, sendcloud_secret')
        .eq('tenant_id', tenant.id)
        .single()

      if (!tenantSettings?.sendcloud_api_key || !tenantSettings?.sendcloud_secret) {
        console.log(`[Cron] Skipping tenant ${tenant.id}: no Sendcloud credentials`)
        results.push({ tenantId: tenant.id, success: true, shipments: 0, returns: 0 })
        continue
      }

      const credentials: SendcloudCredentials = {
        apiKey: tenantSettings.sendcloud_api_key,
        secret: tenantSettings.sendcloud_secret,
      }

      // Get pricing rules once
      const { data: pricingRules } = await adminClient
        .from('pricing_rules')
        .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
        .eq('tenant_id', tenant.id)
        .order('weight_min_grams', { ascending: true })

      // ============================================
      // FETCH DATA (parallel)
      // ============================================
      // Use last sync time to only fetch updated parcels (faster)
      const { data: lastSync } = await adminClient
        .from('sync_runs')
        .select('ended_at')
        .eq('tenant_id', tenant.id)
        .eq('source', 'sendcloud')
        .eq('status', 'success')
        .order('ended_at', { ascending: false })
        .limit(1)
        .single()

      // Fetch parcels updated in the last 2 hours (fallback if no previous sync)
      const since = lastSync?.ended_at || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      console.log(`[Cron] Fetching data in parallel (since: ${since})...`)

      console.log(`[Cron] Pagination budget: ${maxPages} pages per resource`)
      const [parcelsRecent, pendingOrders, returnsRecent] = await fetchCronData(
        credentials,
        since,
        maxPages,
      )

      console.log(`[Cron] Fetched: ${parcelsRecent.length} parcels, ${pendingOrders.length} pending, ${returnsRecent.length} returns`)

      // Merge parcels: parcels take priority over pending orders
      const shipmentMap = new Map<string, ParsedShipment>()
      for (const p of pendingOrders) {
        if (p.order_ref) shipmentMap.set(p.order_ref, p)
      }
      for (const p of parcelsRecent) {
        if (p.order_ref) shipmentMap.set(p.order_ref, p)
        else shipmentMap.set(p.sendcloud_id, p)
      }
      const parcels = Array.from(shipmentMap.values())

      // ============================================
      // DEDUPE 1/2: Drop UUID parcels in the current batch whose order_ref
      // already has a numeric counterpart in DB (UUID-arrives-after-numeric
      // pattern, frequent on ANTEOS). Without this, the UUID would be upserted
      // and its items would consumeStock a second time even though the numeric
      // has already done it.
      // ============================================
      const uuidWithOrderRef = parcels
        .filter(p => p.order_ref && p.sendcloud_id.includes('-'))
        .map(p => ({ id: p.sendcloud_id, ref: p.order_ref as string }))

      if (uuidWithOrderRef.length > 0) {
        const orderRefs = uuidWithOrderRef.map(x => x.ref)
        const { data: existingNumerics } = await adminClient
          .from('shipments')
          .select('order_ref')
          .eq('tenant_id', tenant.id)
          .in('order_ref', orderRefs)
          .not('sendcloud_id', 'like', '%-%')

        if (existingNumerics && existingNumerics.length > 0) {
          const refsWithNumeric = new Set(
            (existingNumerics as Array<{ order_ref: string }>).map(r => r.order_ref),
          )
          const idsToSkip = new Set(
            uuidWithOrderRef.filter(x => refsWithNumeric.has(x.ref)).map(x => x.id),
          )
          if (idsToSkip.size > 0) {
            console.log(`[Cron] Skipping ${idsToSkip.size} UUID parcels (numeric counterpart already in DB)`)
            for (let i = parcels.length - 1; i >= 0; i--) {
              if (idsToSkip.has(parcels[i].sendcloud_id)) parcels.splice(i, 1)
            }
          }
        }
      }

      // ============================================
      // DEDUPE 2/2: When a numeric parcel arrives now and a UUID record for
      // the same order_ref already exists in DB, delete the UUID. CRITICAL:
      // also REVERSE the stock_movements caused by the UUID, otherwise stock
      // stays decremented and the numeric's consumeStock will decrement again
      // -> double consumption (bug observed on ANTEOS 2KG/3KG 28/05).
      // ============================================
      const parcelOrderRefs = parcels
        .filter(p => p.order_ref && !p.sendcloud_id.includes('-'))
        .map(p => p.order_ref)
        .filter((ref): ref is string => ref !== null)

      if (parcelOrderRefs.length > 0) {
        const { data: oldUuidRecords } = await adminClient
          .from('shipments')
          .select('id, sendcloud_id, order_ref')
          .eq('tenant_id', tenant.id)
          .in('order_ref', parcelOrderRefs)
          .like('sendcloud_id', '%-%')

        if (oldUuidRecords && oldUuidRecords.length > 0) {
          const oldIds = (oldUuidRecords as Array<{ id: string }>).map(r => r.id)
          console.log(`[Cron] Cleaning up ${oldIds.length} old UUID records that became parcels`)

          // Step 1: collect stock_movements caused by these UUID shipments so
          // we can reverse them in the snapshot before deletion.
          const { data: uuidMovements } = await adminClient
            .from('stock_movements')
            .select('sku_id, adjustment')
            .eq('tenant_id', tenant.id)
            .eq('movement_type', 'shipment')
            .in('reference_id', oldIds)

          if (uuidMovements && uuidMovements.length > 0) {
            const reverseBySku = new Map<string, number>()
            for (const m of uuidMovements as Array<{ sku_id: string; adjustment: number }>) {
              reverseBySku.set(m.sku_id, (reverseBySku.get(m.sku_id) ?? 0) + -m.adjustment)
            }

            for (const [skuId, delta] of reverseBySku) {
              const { data: snap } = await adminClient
                .from('stock_snapshots')
                .select('qty_current')
                .eq('tenant_id', tenant.id)
                .eq('sku_id', skuId)
                .maybeSingle()
              const before = (snap?.qty_current as number | undefined) ?? 0
              const after = before + delta
              await adminClient
                .from('stock_snapshots')
                .upsert(
                  {
                    tenant_id: tenant.id,
                    sku_id: skuId,
                    qty_current: after,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'tenant_id,sku_id' },
                )
              await adminClient.from('stock_movements').insert({
                tenant_id: tenant.id,
                sku_id: skuId,
                movement_type: 'manual',
                qty_before: before,
                qty_after: after,
                adjustment: delta,
                reason: 'Auto-reverse: doublon UUID/numeric Sendcloud, UUID supprimee',
                reference_type: 'manual',
              })
            }
          }

          // Step 2: delete the UUID shipments (cascade delete shipment_items
          // and unmapped_items via FK).
          await adminClient.from('shipments').delete().in('id', oldIds)
        }
      }

      // ============================================
      // BATCH UPSERT SHIPMENTS
      // ============================================
      console.log(`[Cron] Batch upserting ${parcels.length} shipments...`)

      const shipmentsToUpsert = parcels.map(parcel => {
        let pricingStatus: 'ok' | 'missing' = 'missing'
        let computedCost: number | null = null

        if (pricingRules) {
          const destination = getDestination(parcel.country_code, parcel.carrier, parcel.service_point_id)
          const matchingRule = (pricingRules as PricingRule[]).find(
            (rule) =>
              rule.carrier.toLowerCase() === parcel.carrier.toLowerCase() &&
              rule.destination === destination &&
              rule.weight_min_grams <= parcel.weight_grams &&
              rule.weight_max_grams >= parcel.weight_grams
          )
          if (matchingRule) {
            pricingStatus = 'ok'
            computedCost = Number(matchingRule.price_eur)
          }
        }

        return {
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
          // Error detection fields - important for "Problemes" filter
          has_error: parcel.has_error,
          error_message: parcel.error_message,
        }
      })

      // Identify which sendcloud_ids already exist BEFORE the upsert, so we
      // know which shipments are truly new and need stock consumption afterwards.
      // Without this the cron silently re-creates shipment_items without ever
      // decrementing stock — bug reported by Quentin on REBORN21 le 21/05.
      const newSendcloudIds = new Set<string>()
      if (shipmentsToUpsert.length > 0) {
        const incomingIds = shipmentsToUpsert.map((s) => s.sendcloud_id)
        const { data: existingRows } = await adminClient
          .from('shipments')
          .select('sendcloud_id')
          .eq('tenant_id', tenant.id)
          .in('sendcloud_id', incomingIds)
        const existing = new Set(
          (existingRows || []).map((r: { sendcloud_id: string }) => r.sendcloud_id),
        )
        for (const id of incomingIds) {
          if (!existing.has(id)) newSendcloudIds.add(id)
        }

        const { error: shipmentError } = await adminClient
          .from('shipments')
          .upsert(shipmentsToUpsert, { onConflict: 'tenant_id,sendcloud_id' })

        if (shipmentError) {
          console.error(`[Cron] Shipments batch upsert error:`, shipmentError.message)
        }
      }

      // ============================================
      // PROCESS SHIPMENT ITEMS (SKU mapping)
      // ============================================
      // For every shipment that has parcel_items in raw_json, resolve each
      // item via map_shipment_item RPC. Mapped items go to shipment_items,
      // unmapped items are recorded in unmapped_items (never lost).
      const parcelsWithItems = parcels.filter((p) => {
        const raw = p.raw_json as Record<string, unknown> | null | undefined
        const items = raw?.parcel_items
        return Array.isArray(items) && items.length > 0
      })

      if (parcelsWithItems.length > 0) {
        // Fetch the DB IDs for the upserted shipments by sendcloud_id.
        const sendcloudIds = parcelsWithItems.map((p) => p.sendcloud_id)
        const { data: shipmentRows } = await adminClient
          .from('shipments')
          .select('id, sendcloud_id')
          .eq('tenant_id', tenant.id)
          .in('sendcloud_id', sendcloudIds)

        const idBySendcloudId = new Map<string, string>(
          (shipmentRows || []).map((r: { id: string; sendcloud_id: string }) => [
            r.sendcloud_id,
            r.id,
          ]),
        )

        let totalMapped = 0
        let totalUnmapped = 0

        for (const parcel of parcelsWithItems) {
          const shipmentId = idBySendcloudId.get(parcel.sendcloud_id)
          if (!shipmentId) continue

          const raw = parcel.raw_json as Record<string, unknown>
          const parcelItems = raw.parcel_items as unknown[]

          try {
            const { mappedCount, unmappedCount } = await processShipmentItems(
              adminClient,
              tenant.id,
              shipmentId,
              parcelItems,
            )
            totalMapped += mappedCount
            totalUnmapped += unmappedCount

            // Consume stock only for shipments that were created during THIS
            // sync run (mirrors the webhook's isNewShipment logic). Skipping
            // this caused REBORN21 stock to drift on 21/05.
            if (newSendcloudIds.has(parcel.sendcloud_id) && mappedCount > 0) {
              // Idempotent CAS on stock_consumed_at: even if the webhook processes
              // this same freshly-created parcel concurrently, only one path
              // actually consumes it (fixes the isNewShipment TOCTOU double-count).
              try {
                await consumeShipmentStockOnce(tenant.id, shipmentId)
              } catch (stockError) {
                console.error(
                  `[Cron] Error consuming stock for parcel ${parcel.sendcloud_id}:`,
                  stockError,
                )
              }
            }
          } catch (err) {
            console.error(
              `[Cron] processShipmentItems error for parcel ${parcel.sendcloud_id}:`,
              err,
            )
          }
        }

        console.log(
          `[Cron] Items: ${totalMapped} mapped, ${totalUnmapped} unmapped (across ${parcelsWithItems.length} shipments)`,
        )

      }

      // ============================================
      // BATCH UPSERT RETURNS
      // ============================================
      console.log(`[Cron] Batch upserting ${returnsRecent.length} returns...`)

      const returnsToUpsert = returnsRecent.map((ret: ParsedReturn) => ({
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
      }))

      if (returnsToUpsert.length > 0) {
        const { error: returnsError } = await adminClient
          .from('returns')
          .upsert(returnsToUpsert, { onConflict: 'tenant_id,sendcloud_id' })

        if (returnsError) {
          console.error(`[Cron] Returns batch upsert error:`, returnsError.message)
        }
      }

      // ============================================
      // RECONCILE STUCK "ON HOLD" ORDERS (Mondial Relay status bug)
      // ============================================
      // Small best-effort batch each tick: catch deliveries whose manual
      // "Delivered" flip in Sendcloud never came back down as a parcel. Isolated
      // in try/catch so it can never break the main sync. The status changes it
      // writes are picked up by refreshCronAnalytics at the end of the run.
      try {
        const rec = await reconcileTenant(adminClient, tenant.id, credentials, 15, false)
        if (rec.updated > 0 || rec.errors > 0) {
          console.log(
            `[Cron] Reconcile tenant ${tenant.id}: ${rec.updated} rattrapees, ${rec.noParcelFound} sans colis, ${rec.errors} erreurs`,
          )
        }
      } catch (recErr) {
        console.error(`[Cron] Reconcile step failed for tenant ${tenant.id}:`, recErr)
      }

      // ============================================
      // RECORD SYNC RUN
      // ============================================
      const duration = Date.now() - startTime
      await adminClient.from('sync_runs').insert({
        tenant_id: tenant.id,
        source: 'sendcloud',
        status: 'success',
        ended_at: new Date().toISOString(),
        stats_json: {
          shipments: shipmentsToUpsert.length,
          returns: returnsToUpsert.length,
          duration_ms: duration,
          max_pages: maxPages,
        },
      })

      results.push({
        tenantId: tenant.id,
        success: true,
        shipments: shipmentsToUpsert.length,
        returns: returnsToUpsert.length,
      })

      console.log(`[Cron] Tenant ${tenant.id} done in ${duration}ms`)

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Cron] Error for tenant ${tenant.id}:`, error)

      // P0-cron: persist sync_runs row with status='failed' so the
      // /api/sync/sendcloud/status endpoint and the freshness alerts see the
      // failure. Previously errors were only pushed to `results[]` and lost
      // when the process exited.
      try {
        await adminClient.from('sync_runs').insert({
          tenant_id: tenant.id,
          source: 'sendcloud',
          status: 'failed',
          ended_at: new Date().toISOString(),
          error_text: errMsg,
          stats_json: { error: errMsg },
        })
      } catch (logErr) {
        console.error('[Cron] Failed to persist sync_runs failure row:', logErr)
      }

      results.push({
        tenantId: tenant.id,
        success: false,
        error: errMsg,
      })
    } finally {
      // Release the per-tenant advisory lock - if the tenant errored or
      // returned early, we still need to free it for the next tick.
      try {
        await adminClient.rpc('release_cron_tenant_lock', { p_tenant_id: tenant.id })
      } catch (unlockErr) {
        console.error('[Cron] Failed to release advisory lock:', unlockErr)
      }
    }
  }

  // Refresh each global materialized view exactly once. The previous flow ran
  // refresh_sku_metrics once per tenant and then refreshed it again inside the
  // consolidated RPC. It also skipped dashboard/SKU refreshes whenever the
  // physical-items refresh timed out.
  await refreshCronAnalytics(adminClient)

  const totalDuration = Date.now() - startTime
  console.log(`\n[Cron] *** SYNC COMPLETE in ${totalDuration}ms ***`)
}

// This endpoint is called by cron-job.org every 5 minutes
// Returns immediately (< 1s) and runs sync in background
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Start sync in background (don't await - Node.js process stays alive on Render)
  runSync().catch((err) => console.error('[Cron] Background sync error:', err))

  // Return immediately
  return NextResponse.json({
    success: true,
    message: 'Sync started in background',
    timestamp: new Date().toISOString(),
  })
}
