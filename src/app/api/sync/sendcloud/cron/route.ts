import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import {
  fetchAllParcels,
  fetchAllReturns,
  fetchAllIntegrationShipments,
  fetchIntegrations,
  fetchIntegrationShipmentBatch,
  fetchParcelBatch,
  fetchReturnBatch,
  type BoundedFetchResult,
  type IntegrationFetchResult,
  type PaginationCapHandler,
  type PaginationCapNotice,
} from '@/lib/sendcloud/client'
import type { SendcloudCredentials, ParsedShipment, ParsedReturn } from '@/lib/sendcloud/types'
import type { PricingRule } from '@/lib/utils/pricing'
import { processShipmentItems } from '@/lib/utils/sku-mapping'
import { consumeShipmentStockOnce } from '@/lib/stock/consume'
import { isConsumableStatus } from '@/lib/stock/consumable-status'
import { reconcileTenant } from '@/lib/sendcloud/reconcile'
import { getCronMaxPages } from '@/lib/sendcloud/pagination'
import { safeEqual } from '@/lib/utils/safe-compare'
import { reverseDuplicateShipmentStock } from '@/lib/stock/reverse-duplicates'
import { reconcileTenantStock, type StockReconcileResult } from '@/lib/stock/reconcile-stock'
import { buildShipmentRow } from '@/lib/sendcloud/build-shipment-row'
import {
  createSyncCorrelationId,
  createSyncLogger,
  type SyncLogger,
} from '@/lib/sendcloud/sync-logger'
import {
  enqueueBatchCap,
  enqueueDetectedSyncBatch,
  resolveAutoFixGate,
} from '@/lib/auto-fix'
import {
  AUTO_FIX_MODE_COLUMN,
  CRON_TENANT_SETTINGS_COLUMNS,
  loadCronTenantSettings,
  loadTenantAutoFixMode,
} from '@/lib/sendcloud/cron-settings'
import {
  integrationContinuation,
  loadIncrementalDrain,
  loadIntegrationContinuations,
  persistIncrementalDrain,
  persistIntegrationContinuation,
  recordCheckpointFailure,
  restartIncrementalDrain,
  isAnomalousEmptyResume,
  type IntegrationContinuation,
  type StoredIntegrationContinuation,
} from '@/lib/sendcloud/checkpoints'

type ResourceName = 'parcels' | 'integration_shipments' | 'returns'
type ResourceStatus = 'success' | 'partial' | 'failed'

interface ResourceSyncStats {
  [key: string]: string | number | boolean | undefined
  status: ResourceStatus
  fetched: number
  pages_fetched: number
  pagination_capped: boolean
  has_more: boolean
  resumed: boolean
  watermark_before?: string
  watermark_after?: string
  checkpoint_reset_reason?: string
  error?: string
}

interface IntegrationBatchOutcome {
  checkpoint: IntegrationContinuation
  result?: IntegrationFetchResult
  error?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function fetchIntegrationBatches(
  credentials: SendcloudCredentials,
  maxPages: number,
  cycleStartedAt: string,
  stored: Map<number, StoredIntegrationContinuation>,
  onPaginationCap?: PaginationCapHandler,
): Promise<IntegrationBatchOutcome[]> {
  const integrations = await fetchIntegrations(credentials, true)
  const outcomes: IntegrationBatchOutcome[] = []

  // Deliberately serial, as before the checkpoint change: maxPages remains a
  // per-integration hard cap and we do not add a burst of parallel API/DB work.
  for (const integration of integrations) {
    if (integration.system === 'api') continue
    const checkpoint = integrationContinuation(
      integration.id,
      cycleStartedAt,
      stored.get(integration.id),
    )
    try {
      const result = await fetchIntegrationShipmentBatch(
        credentials,
        integration.id,
        maxPages,
        checkpoint.continuationUrl,
        onPaginationCap,
      )
      outcomes.push({ checkpoint, result })
    } catch (error) {
      outcomes.push({ checkpoint, error: errorMessage(error) })
    }
  }
  return outcomes
}

function aggregateIntegrationStats(outcomes: IntegrationBatchOutcome[]): ResourceSyncStats {
  const fetched = outcomes.filter((outcome) => outcome.result)
  const successful = outcomes.filter((outcome) => outcome.result && !outcome.error)
  const failures = outcomes.filter((outcome) => outcome.error)
  const hasMore = fetched.some((outcome) => outcome.result?.hasMore)
  const status: ResourceStatus = failures.length > 0
    ? (successful.length > 0 ? 'partial' : 'failed')
    : (hasMore ? 'partial' : 'success')

  return {
    status,
    fetched: fetched.reduce((sum, outcome) => sum + (outcome.result?.items.length || 0), 0),
    pages_fetched: fetched.reduce((sum, outcome) => sum + (outcome.result?.pagesFetched || 0), 0),
    pagination_capped: hasMore,
    has_more: hasMore,
    resumed: outcomes.some((outcome) => outcome.checkpoint.resuming),
    ...(failures.length > 0
      ? { error: failures.map((outcome) => outcome.error).join('; ') }
      : {}),
  }
}

export function overallRunStatus(resources: Record<ResourceName, ResourceSyncStats>): ResourceStatus {
  const statuses = Object.values(resources).map((resource) => resource.status)
  if (statuses.every((status) => status === 'success')) return 'success'
  if (statuses.every((status) => status === 'failed')) return 'failed'
  return 'partial'
}

export async function fetchCronData(
  credentials: SendcloudCredentials,
  since: string,
  maxPages: number,
  onPaginationCap?: PaginationCapHandler,
) {
  return Promise.all([
    fetchAllParcels(credentials, since, maxPages, onPaginationCap),
    fetchAllIntegrationShipments(credentials, maxPages, onPaginationCap),
    fetchAllReturns(credentials, since, maxPages, onPaginationCap),
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
  const autoFixGate = resolveAutoFixGate(process.env)

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

      // Credentials are on the vital sync path. Keep this query independent
      // from every Phase 2 column and surface database errors as failed runs.
      let tenantSettings
      try {
        tenantSettings = await loadCronTenantSettings(() => adminClient
          .from('tenant_settings')
          .select(CRON_TENANT_SETTINGS_COLUMNS)
          .eq('tenant_id', tenant.id)
          .maybeSingle())
      } catch (settingsError) {
        logger.error(`Failed to load Sendcloud settings for tenant ${tenant.id}:`, settingsError)
        throw settingsError
      }

      if (!tenantSettings?.sendcloud_api_key || !tenantSettings?.sendcloud_secret) {
        logger.info(`Skipping tenant ${tenant.id}: no Sendcloud credentials`)
        results.push({ tenantId: tenant.id, success: true, shipments: 0, returns: 0 })
        continue
      }

      const credentials: SendcloudCredentials = {
        apiKey: tenantSettings.sendcloud_api_key,
        secret: tenantSettings.sendcloud_secret,
      }

      // Optional and fail-closed. When the global gate is closed this callback
      // is never evaluated, so a pre-00093 restore cannot affect the vital sync.
      const tenantAutoFix = await loadTenantAutoFixMode(autoFixGate.enabled, () => adminClient
        .from('tenant_settings')
        .select(AUTO_FIX_MODE_COLUMN)
        .eq('tenant_id', tenant.id)
        .maybeSingle())
      if (tenantAutoFix.error) {
        logger.error(
          `Auto-fix mode lookup failed for tenant ${tenant.id}; continuing with auto-fix off:`,
          tenantAutoFix.error,
        )
      }

      // Get pricing rules once
      const { data: pricingRules } = await adminClient
        .from('pricing_rules')
        .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
        .eq('tenant_id', tenant.id)
        .order('weight_min_grams', { ascending: true })

      // ============================================
      // FETCH DATA (bounded, checkpointed per resource)
      // ============================================
      // sync_runs is only a bootstrap source for tenants that do not have a
      // checkpoint yet. Once a checkpoint exists, ended_at never drives the
      // incremental watermark again.
      const { data: lastSync } = await adminClient
        .from('sync_runs')
        .select('ended_at')
        .eq('tenant_id', tenant.id)
        .eq('source', 'sendcloud')
        .eq('status', 'success')
        .order('ended_at', { ascending: false })
        .limit(1)
        .single()

      const fallbackWatermark = lastSync?.ended_at
        || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const cycleStartedAt = new Date().toISOString()
      logger.info(`Pagination budget: ${maxPages} pages per resource`)
      const paginationCaps: PaginationCapNotice[] = []
      const onPaginationCap = (notice: PaginationCapNotice) => paginationCaps.push(notice)

      const [parcelDrain, returnDrain, storedIntegrationContinuations] = await Promise.all([
        loadIncrementalDrain(
          adminClient,
          tenant.id,
          'parcels',
          fallbackWatermark,
          cycleStartedAt,
        ),
        loadIncrementalDrain(
          adminClient,
          tenant.id,
          'returns',
          fallbackWatermark,
          cycleStartedAt,
        ),
        loadIntegrationContinuations(adminClient, tenant.id, cycleStartedAt),
      ])

      logger.info('Incremental drains:', {
        parcels: { since: parcelDrain.watermark, resumed: parcelDrain.resuming },
        returns: { since: returnDrain.watermark, resumed: returnDrain.resuming },
      })

      const [parcelSettled, integrationSettled, returnSettled] = await Promise.allSettled([
        fetchParcelBatch(
          credentials,
          parcelDrain.watermark,
          parcelDrain.cursor,
          maxPages,
          onPaginationCap,
        ),
        fetchIntegrationBatches(
          credentials,
          maxPages,
          cycleStartedAt,
          storedIntegrationContinuations,
          onPaginationCap,
        ),
        fetchReturnBatch(
          credentials,
          returnDrain.watermark,
          returnDrain.cursor,
          maxPages,
          onPaginationCap,
        ),
      ])

      const parcelFetch: BoundedFetchResult<ParsedShipment> | undefined =
        parcelSettled.status === 'fulfilled' ? parcelSettled.value : undefined
      const integrationOutcomes: IntegrationBatchOutcome[] =
        integrationSettled.status === 'fulfilled' ? integrationSettled.value : []
      const returnFetch: BoundedFetchResult<ParsedReturn> | undefined =
        returnSettled.status === 'fulfilled' ? returnSettled.value : undefined

      const resourceStats: Record<ResourceName, ResourceSyncStats> = {
        parcels: parcelFetch ? {
          status: parcelFetch.hasMore ? 'partial' : 'success',
          fetched: parcelFetch.items.length,
          pages_fetched: parcelFetch.pagesFetched,
          pagination_capped: parcelFetch.hasMore,
          has_more: parcelFetch.hasMore,
          resumed: parcelDrain.resuming,
          watermark_before: parcelDrain.watermark,
          ...(parcelDrain.resetReason
            ? { checkpoint_reset_reason: parcelDrain.resetReason }
            : {}),
        } : {
          status: 'failed',
          fetched: 0,
          pages_fetched: 0,
          pagination_capped: false,
          has_more: parcelDrain.resuming,
          resumed: parcelDrain.resuming,
          watermark_before: parcelDrain.watermark,
          ...(parcelDrain.resetReason
            ? { checkpoint_reset_reason: parcelDrain.resetReason }
            : {}),
          error: errorMessage(
            parcelSettled.status === 'rejected' ? parcelSettled.reason : 'unknown parcels error',
          ),
        },
        integration_shipments: integrationSettled.status === 'fulfilled'
          ? aggregateIntegrationStats(integrationOutcomes)
          : {
            status: 'failed',
            fetched: 0,
            pages_fetched: 0,
            pagination_capped: false,
            has_more: storedIntegrationContinuations.size > 0,
            resumed: storedIntegrationContinuations.size > 0,
            error: errorMessage(integrationSettled.reason),
          },
        returns: returnFetch ? {
          status: returnFetch.hasMore ? 'partial' : 'success',
          fetched: returnFetch.items.length,
          pages_fetched: returnFetch.pagesFetched,
          pagination_capped: returnFetch.hasMore,
          has_more: returnFetch.hasMore,
          resumed: returnDrain.resuming,
          watermark_before: returnDrain.watermark,
          ...(returnDrain.resetReason
            ? { checkpoint_reset_reason: returnDrain.resetReason }
            : {}),
        } : {
          status: 'failed',
          fetched: 0,
          pages_fetched: 0,
          pagination_capped: false,
          has_more: returnDrain.resuming,
          resumed: returnDrain.resuming,
          watermark_before: returnDrain.watermark,
          ...(returnDrain.resetReason
            ? { checkpoint_reset_reason: returnDrain.resetReason }
            : {}),
          error: errorMessage(
            returnSettled.status === 'rejected' ? returnSettled.reason : 'unknown returns error',
          ),
        },
      }

      const parcelsRecent = parcelFetch?.items || []
      const pendingOrders = integrationOutcomes.flatMap((outcome) => outcome.result?.items || [])
      const returnsRecent = returnFetch?.items || []

      // Count only failed resumptions. This write happens exclusively on the
      // error path and remains one bounded row update per affected resource.
      if (parcelSettled.status === 'rejected' && parcelDrain.resuming) {
        try {
          await recordCheckpointFailure(
            adminClient,
            tenant.id,
            'parcels',
            '',
            parcelDrain.failureCount,
          )
        } catch (error) {
          logger.error('Failed to record parcels checkpoint failure:', error)
        }
      }
      if (returnSettled.status === 'rejected' && returnDrain.resuming) {
        try {
          await recordCheckpointFailure(
            adminClient,
            tenant.id,
            'returns',
            '',
            returnDrain.failureCount,
          )
        } catch (error) {
          logger.error('Failed to record returns checkpoint failure:', error)
        }
      }
      for (const outcome of integrationOutcomes) {
        if (!outcome.error || !outcome.checkpoint.resuming) continue
        try {
          await recordCheckpointFailure(
            adminClient,
            tenant.id,
            'integration_shipments',
            String(outcome.checkpoint.integrationId),
            outcome.checkpoint.failureCount,
          )
        } catch (error) {
          logger.error(
            `Failed to record integration ${outcome.checkpoint.integrationId} checkpoint failure:`,
            error,
          )
        }
      }

      if (paginationCaps.length > 0) {
        logger.warn('Pagination cap reached:', paginationCaps)
      }

      logger.info(`Fetched: ${parcelsRecent.length} parcels, ${pendingOrders.length} pending, ${returnsRecent.length} returns`, {
        resources: resourceStats,
      })

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
      let shipmentPersistenceError: string | undefined

      // Capture the consumption marker before the upsert. Eligibility is based
      // on the current status, not on row creation: an existing On-Hold order
      // must consume when it later transitions to Fulfilled/Completed.
      const existingConsumedAt = new Map<string, string | null>()
      let consumptionLookupSucceeded = true
      if (shipmentsToUpsert.length > 0) {
        const incomingIds = shipmentsToUpsert.map((s) => s.sendcloud_id)
        const { data: existingRows, error: existingRowsError } = await adminClient
          .from('shipments')
          .select('sendcloud_id, stock_consumed_at')
          .eq('tenant_id', tenant.id)
          .in('sendcloud_id', incomingIds)
        if (existingRowsError) {
          consumptionLookupSucceeded = false
          logger.error('Stock consumption marker lookup failed; deferring to sweeper:', existingRowsError)
        } else {
          for (const row of (existingRows ?? []) as Array<{
            sendcloud_id: string
            stock_consumed_at: string | null
          }>) {
            existingConsumedAt.set(row.sendcloud_id, row.stock_consumed_at)
          }
        }

        const { error: shipmentError } = await adminClient
          .from('shipments')
          .upsert(shipmentsToUpsert, { onConflict: 'tenant_id,sendcloud_id' })

        if (shipmentError) {
          logger.error('Shipments batch upsert error:', shipmentError.message)
          shipmentPersistenceError = shipmentError.message
        }
      }

      // ============================================
      // AUTO-FIX DETECTION (QUEUE ONLY, DRY-RUN)
      // ============================================
      // Work only from the bounded Sendcloud batch already in memory. The sole
      // lookup is capped and uses (tenant_id, sendcloud_id); no shipments scan
      // and no Sendcloud call are introduced here. Worker execution is separate.
      let autoFixDetectionStats: Awaited<ReturnType<typeof enqueueDetectedSyncBatch>> | null = null
      if (tenantAutoFix.mode === 'simulated') {
        try {
          autoFixDetectionStats = await enqueueDetectedSyncBatch(
            adminClient,
            tenant.id,
            parcels,
            {
              defaultHsCode: tenantSettings.default_hs_code,
              defaultOriginCountry: tenantSettings.default_origin_country,
            },
            async (sendcloudIds) => {
              const { data, error } = await adminClient
                .from('shipments')
                .select('id, sendcloud_id')
                .eq('tenant_id', tenant.id)
                .in('sendcloud_id', sendcloudIds)
              if (error) throw new Error(`auto-fix shipment ID lookup: ${error.message}`)
              return new Map(
                (data ?? []).map((row) => [row.sendcloud_id, row.id] as const),
              )
            },
            enqueueBatchCap(process.env),
          )
          if (autoFixDetectionStats.detected > 0 || autoFixDetectionStats.truncated) {
            logger.info(`Auto-fix dry-run queue for tenant ${tenant.id}:`, autoFixDetectionStats)
          }
        } catch (autoFixError) {
          // Detection is observability-only in this lot. It must never fail the
          // shipment sync or alter stock processing.
          logger.error(`Auto-fix dry-run enqueue failed for tenant ${tenant.id}:`, autoFixError)
        }
      } else if (tenantAutoFix.mode === 'live') {
        logger.warn(`Auto-fix live ignored for tenant ${tenant.id}: this release is dry-run only`)
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

            if (
              consumptionLookupSucceeded &&
              isConsumableStatus(parcel) &&
              existingConsumedAt.get(parcel.sendcloud_id) == null &&
              mappedCount > 0
            ) {
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
      let returnsPersistenceError: string | undefined

      if (returnsToUpsert.length > 0) {
        const { error: returnsError } = await adminClient
          .from('returns')
          .upsert(returnsToUpsert, { onConflict: 'tenant_id,sendcloud_id' })

        if (returnsError) {
          logger.error('Returns batch upsert error:', returnsError.message)
          returnsPersistenceError = returnsError.message
        }
      }

      // ============================================
      // COMMIT RESOURCE CHECKPOINTS
      // ============================================
      // A checkpoint is written only after its bounded batch is durably
      // upserted. Reprocessing after a checkpoint failure is safe because the
      // business upserts are idempotent and stock consumption remains guarded
      // by the existing stock_consumed_at CAS.
      if (parcelFetch) {
        if (shipmentPersistenceError) {
          resourceStats.parcels.status = 'failed'
          resourceStats.parcels.error = shipmentPersistenceError
        } else {
          try {
            if (isAnomalousEmptyResume(parcelDrain, parcelFetch.items.length)) {
              await restartIncrementalDrain(adminClient, tenant.id, parcelDrain)
              resourceStats.parcels.status = 'partial'
              resourceStats.parcels.has_more = false
              resourceStats.parcels.watermark_after = parcelDrain.watermark
              resourceStats.parcels.checkpoint_reset_reason = 'empty_resume'
            } else {
              resourceStats.parcels.watermark_after = await persistIncrementalDrain(
                adminClient,
                tenant.id,
                parcelDrain,
                parcelFetch,
              )
            }
          } catch (error) {
            resourceStats.parcels.status = 'failed'
            resourceStats.parcels.error = errorMessage(error)
          }
        }
      }

      for (const outcome of integrationOutcomes) {
        if (!outcome.result) continue
        if (shipmentPersistenceError) {
          outcome.error = shipmentPersistenceError
          continue
        }
        try {
          await persistIntegrationContinuation(
            adminClient,
            tenant.id,
            outcome.checkpoint,
            outcome.result,
          )
        } catch (error) {
          outcome.error = errorMessage(error)
        }
      }
      resourceStats.integration_shipments = aggregateIntegrationStats(integrationOutcomes)

      if (returnFetch) {
        if (returnsPersistenceError) {
          resourceStats.returns.status = 'failed'
          resourceStats.returns.error = returnsPersistenceError
        } else {
          try {
            if (isAnomalousEmptyResume(returnDrain, returnFetch.items.length)) {
              await restartIncrementalDrain(adminClient, tenant.id, returnDrain)
              resourceStats.returns.status = 'partial'
              resourceStats.returns.has_more = false
              resourceStats.returns.watermark_after = returnDrain.watermark
              resourceStats.returns.checkpoint_reset_reason = 'empty_resume'
            } else {
              resourceStats.returns.watermark_after = await persistIncrementalDrain(
                adminClient,
                tenant.id,
                returnDrain,
                returnFetch,
              )
            }
          } catch (error) {
            resourceStats.returns.status = 'failed'
            resourceStats.returns.error = errorMessage(error)
          }
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
      // BOUNDED STOCK RECONCILIATION
      // ============================================
      // Runs under the tenant lock already held by this loop. Its own hard cap
      // is 200 and a failure is observability-only for the shipment sync.
      let stockReconciliation: StockReconcileResult | null = null
      try {
        stockReconciliation = await reconcileTenantStock(adminClient, tenant.id, 200)
        if (stockReconciliation.consumed > 0 || stockReconciliation.reversed > 0) {
          logger.info(`Stock reconcile tenant ${tenant.id}:`, stockReconciliation)
        }
      } catch (stockReconcileError) {
        logger.error(`Stock reconcile failed for tenant ${tenant.id}:`, stockReconcileError)
      }

      // ============================================
      // RECORD SYNC RUN
      // ============================================
      const duration = Date.now() - startTime
      const runStatus = overallRunStatus(resourceStats)
      const resourceErrors = Object.entries(resourceStats)
        .filter(([, stats]) => stats.error)
        .map(([resource, stats]) => `${resource}: ${stats.error}`)
        .join('; ')
      await adminClient.from('sync_runs').insert({
        tenant_id: tenant.id,
        source: 'sendcloud',
        status: runStatus,
        ended_at: new Date().toISOString(),
        error_text: resourceErrors || null,
        stats_json: {
          shipments: shipmentsToUpsert.length,
          returns: returnsToUpsert.length,
          duration_ms: duration,
          max_pages: maxPages,
          pagination_capped: Object.values(resourceStats)
            .some((resource) => resource.pagination_capped),
          pagination_caps: paginationCaps,
          resources: resourceStats,
          auto_fix_detection: autoFixDetectionStats === null ? null : {
            observed: autoFixDetectionStats.observed,
            eligible: autoFixDetectionStats.eligible,
            resolved: autoFixDetectionStats.resolved,
            detected: autoFixDetectionStats.detected,
            enqueued_or_seen: autoFixDetectionStats.enqueuedOrSeen,
            truncated: autoFixDetectionStats.truncated,
          },
          stock_reconciliation: stockReconciliation === null ? null : {
            consumed: stockReconciliation.consumed,
            reversed: stockReconciliation.reversed,
            paused: stockReconciliation.paused,
          },
          correlation_id: correlationId,
        },
      })

      results.push({
        tenantId: tenant.id,
        success: runStatus !== 'failed',
        shipments: shipmentsToUpsert.length,
        returns: returnsToUpsert.length,
      })

      logger.info(`Tenant ${tenant.id} done in ${duration}ms with status=${runStatus}`)

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

  if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // KILL-SWITCH (incident DB 13/07): fail-safe pause. Le cron TOURNE par defaut
  // (la cause racine — maxPages 10->2 — est corrigee). En cas de nouveau stress
  // I/O, definir SYNC_PAUSED=true sur Render met le cron en pause INSTANTANEMENT
  // (pas besoin de redeploiement); retirer la variable le relance.
  if (process.env.SYNC_PAUSED === 'true') {
    logger.info('Cron paused (SYNC_PAUSED=true)')
    return NextResponse.json({ success: false, paused: true, message: 'Sync paused (SYNC_PAUSED)' })
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
