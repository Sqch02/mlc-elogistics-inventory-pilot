import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { fetchAllParcels, fetchAllReturns, fetchAllIntegrationShipments } from '@/lib/sendcloud/client'
import type { SendcloudCredentials, ParsedShipment, ParsedReturn } from '@/lib/sendcloud/types'
import type { PricingRule } from '@/lib/utils/pricing'
import { processShipmentItems } from '@/lib/utils/sku-mapping'
import { consumeShipmentStockOnce } from '@/lib/stock/consume'
import { reconcileTenant } from '@/lib/sendcloud/reconcile'
import { getCronMaxPages } from '@/lib/sendcloud/pagination'
import { reverseDuplicateShipmentStock } from '@/lib/stock/reverse-duplicates'
import { buildShipmentRow } from '@/lib/sendcloud/build-shipment-row'
import {
  createSyncCorrelationId,
  createSyncLogger,
  type SyncLogger,
} from '@/lib/sendcloud/sync-logger'

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
  adminClient: {
    rpc: (name: typeof ANALYTICS_REFRESH_RPCS[number]) => PromiseLike<{ error: unknown }>
  },
  logger: SyncLogger = createSyncLogger('Cron', createSyncCorrelationId()),
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
        logger.error(`${rpcName} failed:`, error)
      } else {
        refreshed.push(rpcName)
        logger.info(`${rpcName} completed`)
      }
    } catch (error) {
      failed.push(rpcName)
      logger.error(`${rpcName} failed:`, error)
    }
  }

  return { refreshed, failed }
}

// Background sync function - runs after response is sent
async function runSync(correlationId: string) {
  const startTime = Date.now()
  const maxPages = getCronMaxPages()
  const logger = createSyncLogger('Cron', correlationId)
  logger.info('*** SYNC STARTED (BACKGROUND) ***', {
    timestamp: new Date().toISOString(),
  })

  const adminClient = getAdminDb()

  const { data: tenants, error: tenantsError } = await adminClient
    .from('tenants')
    .select('id')

  if (tenantsError || !tenants) {
    logger.error('Failed to get tenants:', tenantsError)
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
      logger.warn(`Skipping tenant ${tenant.id}: previous sync still holds the lock`)
      results.push({ tenantId: tenant.id, success: true, shipments: 0, returns: 0, skipped: 'lock_held' })
      continue
    }

    try {
      logger.info(`======= TENANT: ${tenant.id} =======`)

      // Get credentials
      const { data: tenantSettings } = await adminClient
        .from('tenant_settings')
        .select('sendcloud_api_key, sendcloud_secret')
        .eq('tenant_id', tenant.id)
        .single()

      if (!tenantSettings?.sendcloud_api_key || !tenantSettings?.sendcloud_secret) {
        logger.info(`Skipping tenant ${tenant.id}: no Sendcloud credentials`)
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
      logger.info(`Fetching data in parallel (since: ${since})...`)

      logger.info(`Pagination budget: ${maxPages} pages per resource`)
      const [parcelsRecent, pendingOrders, returnsRecent] = await fetchCronData(
        credentials,
        since,
        maxPages,
      )

      logger.info(`Fetched: ${parcelsRecent.length} parcels, ${pendingOrders.length} pending, ${returnsRecent.length} returns`)

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
            logger.info(`Skipping ${idsToSkip.size} UUID parcels (numeric counterpart already in DB)`)
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
          logger.info(`Cleaning up ${oldIds.length} old UUID records that became parcels`)
          const reversal = await reverseDuplicateShipmentStock(
            adminClient,
            tenant.id,
            oldIds,
          )
          logger.info(
            `Duplicate reversal: ${reversal.shipmentsDeleted} shipments, ${reversal.skusReversed} SKUs, ${reversal.unitsReversed} units${reversal.usedFallback ? ' (fallback)' : ''}`,
          )
        }
      }

      // ============================================
      // BATCH UPSERT SHIPMENTS
      // ============================================
      logger.info(`Batch upserting ${parcels.length} shipments...`)

      const shipmentsToUpsert = parcels.map((parcel) =>
        buildShipmentRow(tenant.id, parcel, pricingRules as PricingRule[] | null),
      )

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
          logger.error('Shipments batch upsert error:', shipmentError.message)
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
                logger.error(
                  `Error consuming stock for parcel ${parcel.sendcloud_id}:`,
                  stockError,
                )
              }
            }
          } catch (err) {
            logger.error(
              `processShipmentItems error for parcel ${parcel.sendcloud_id}:`,
              err,
            )
          }
        }

        logger.info(
          `Items: ${totalMapped} mapped, ${totalUnmapped} unmapped (across ${parcelsWithItems.length} shipments)`,
        )

      }

      // ============================================
      // BATCH UPSERT RETURNS
      // ============================================
      logger.info(`Batch upserting ${returnsRecent.length} returns...`)

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
          logger.error('Returns batch upsert error:', returnsError.message)
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
        const rec = await reconcileTenant(
          adminClient,
          tenant.id,
          credentials,
          15,
          false,
          correlationId,
        )
        if (rec.updated > 0 || rec.errors > 0) {
          logger.info(
            `Reconcile tenant ${tenant.id}: ${rec.updated} rattrapees, ${rec.noParcelFound} sans colis, ${rec.errors} erreurs`,
          )
        }
      } catch (recErr) {
        logger.error(`Reconcile step failed for tenant ${tenant.id}:`, recErr)
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
          correlation_id: correlationId,
        },
      })

      results.push({
        tenantId: tenant.id,
        success: true,
        shipments: shipmentsToUpsert.length,
        returns: returnsToUpsert.length,
      })

      logger.info(`Tenant ${tenant.id} done in ${duration}ms`)

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Error for tenant ${tenant.id}:`, error)

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
          stats_json: { error: errMsg, correlation_id: correlationId },
        })
      } catch (logErr) {
        logger.error('Failed to persist sync_runs failure row:', logErr)
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
        logger.error('Failed to release advisory lock:', unlockErr)
      }
    }
  }

  // Refresh each global materialized view exactly once. The previous flow ran
  // refresh_sku_metrics once per tenant and then refreshed it again inside the
  // consolidated RPC. It also skipped dashboard/SKU refreshes whenever the
  // physical-items refresh timed out.
  await refreshCronAnalytics(adminClient, logger)

  const totalDuration = Date.now() - startTime
  logger.info(`*** SYNC COMPLETE in ${totalDuration}ms ***`)
}

// This endpoint is called by cron-job.org every 5 minutes
// Returns immediately (< 1s) and runs sync in background
export async function GET(request: NextRequest) {
  const correlationId = createSyncCorrelationId()
  const logger = createSyncLogger('Cron', correlationId)
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Start sync in background (don't await - Node.js process stays alive on Render)
  runSync(correlationId).catch((err) => logger.error('Background sync error:', err))

  // Return immediately
  return NextResponse.json({
    success: true,
    correlationId,
    message: 'Sync started in background',
    timestamp: new Date().toISOString(),
  })
}
