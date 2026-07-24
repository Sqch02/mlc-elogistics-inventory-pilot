import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type IncrementalResource = 'parcels' | 'returns'
export type CheckpointResource = IncrementalResource | 'integration_shipments'

export const CHECKPOINT_MAX_RESUME_AGE_MS = 2 * 60 * 60 * 1000
export const CHECKPOINT_MAX_CONSECUTIVE_FAILURES = 3

export interface IncrementalDrain {
  resource: IncrementalResource
  watermark: string
  cursor?: string
  windowEndsAt: string
  resuming: boolean
  failureCount: number
  resetReason?: 'stale' | 'repeated_failures'
}

export interface IntegrationContinuation {
  integrationId: number
  continuationUrl?: string
  snapshotStartedAt: string
  resuming: boolean
  failureCount: number
}

export interface StoredIntegrationContinuation {
  continuationUrl: string
  snapshotStartedAt: string
  failureCount: number
}

type AdminClient = SupabaseClient<Database>

interface CheckpointError {
  code?: string
  message: string
}

function isMissingCheckpointTable(error: CheckpointError | null): boolean {
  if (!error) return false

  const message = error.message.toLowerCase()
  if (!message.includes('sendcloud_sync_checkpoints')) return false

  if (error.code === '42P01') return message.includes('does not exist')
  if (error.code === 'PGRST205') {
    return message.includes('could not find the table') && message.includes('schema cache')
  }

  // Some adapters omit/normalize the code. The fallback stays deliberately
  // narrow: it must name this exact table and explicitly describe absence.
  return message.includes('does not exist')
    || (message.includes('could not find the table') && message.includes('schema cache'))
}

function checkpointError(action: string, error: CheckpointError): Error {
  return new Error(`Sendcloud checkpoint ${action}: ${error.message}`)
}

function freshIncrementalDrain(
  resource: IncrementalResource,
  watermark: string,
  cycleStartedAt: string,
  resetReason?: IncrementalDrain['resetReason'],
): IncrementalDrain {
  return {
    resource,
    watermark,
    windowEndsAt: cycleStartedAt,
    resuming: false,
    failureCount: 0,
    ...(resetReason ? { resetReason } : {}),
  }
}

function resumeResetReason(
  updatedAt: string,
  cycleStartedAt: string,
  failureCount: number,
): IncrementalDrain['resetReason'] | undefined {
  if (failureCount >= CHECKPOINT_MAX_CONSECUTIVE_FAILURES) return 'repeated_failures'
  const updatedTime = Date.parse(updatedAt)
  const cycleTime = Date.parse(cycleStartedAt)
  if (
    !Number.isFinite(updatedTime)
    || !Number.isFinite(cycleTime)
    || cycleTime - updatedTime > CHECKPOINT_MAX_RESUME_AGE_MS
  ) {
    return 'stale'
  }
  return undefined
}

export async function loadIncrementalDrain(
  client: AdminClient,
  tenantId: string,
  resource: IncrementalResource,
  fallbackWatermark: string,
  cycleStartedAt: string,
): Promise<IncrementalDrain> {
  const { data, error } = await client
    .from('sendcloud_sync_checkpoints')
    .select('watermark, cursor, window_ends_at, has_more, consecutive_failures, updated_at')
    .eq('tenant_id', tenantId)
    .eq('resource', resource)
    .eq('partition_key', '')
    .maybeSingle()

  if (isMissingCheckpointTable(error)) {
    return freshIncrementalDrain(resource, fallbackWatermark, cycleStartedAt)
  }
  if (error) throw checkpointError(`load ${resource}`, error)

  if (data?.has_more) {
    if (!data.watermark || !data.cursor || !data.window_ends_at) {
      throw new Error(`Invalid persisted ${resource} checkpoint for tenant ${tenantId}`)
    }
    const resetReason = resumeResetReason(
      data.updated_at,
      cycleStartedAt,
      data.consecutive_failures,
    )
    if (resetReason) {
      return freshIncrementalDrain(resource, data.watermark, cycleStartedAt, resetReason)
    }
    return {
      resource,
      watermark: data.watermark,
      cursor: data.cursor,
      windowEndsAt: data.window_ends_at,
      resuming: true,
      failureCount: data.consecutive_failures,
    }
  }

  return freshIncrementalDrain(
    resource,
    data?.watermark || fallbackWatermark,
    cycleStartedAt,
  )
}

export async function persistIncrementalDrain(
  client: AdminClient,
  tenantId: string,
  drain: IncrementalDrain,
  continuation: { hasMore: boolean; nextCursor?: string },
): Promise<string> {
  const nextCursor: string | null = continuation.hasMore
    ? (continuation.nextCursor ?? null)
    : null
  if (continuation.hasMore && !nextCursor) {
    throw new Error(`Missing next cursor for partial ${drain.resource} checkpoint`)
  }

  const completedWatermark = continuation.hasMore
    ? drain.watermark
    : drain.windowEndsAt
  const { error } = await client.from('sendcloud_sync_checkpoints').upsert({
    tenant_id: tenantId,
    resource: drain.resource,
    partition_key: '',
    watermark: completedWatermark,
    cursor: nextCursor,
    continuation_url: null,
    window_ends_at: continuation.hasMore ? drain.windowEndsAt : null,
    has_more: continuation.hasMore,
    consecutive_failures: 0,
  }, { onConflict: 'tenant_id,resource,partition_key' })

  if (isMissingCheckpointTable(error)) return completedWatermark
  if (error) throw checkpointError(`persist ${drain.resource}`, error)
  return completedWatermark
}

export function isAnomalousEmptyResume(
  drain: IncrementalDrain,
  fetchedCount: number,
): boolean {
  return drain.resuming && fetchedCount === 0
}

export async function restartIncrementalDrain(
  client: AdminClient,
  tenantId: string,
  drain: IncrementalDrain,
): Promise<void> {
  const { error } = await client.from('sendcloud_sync_checkpoints').upsert({
    tenant_id: tenantId,
    resource: drain.resource,
    partition_key: '',
    watermark: drain.watermark,
    cursor: null,
    continuation_url: null,
    window_ends_at: null,
    has_more: false,
    consecutive_failures: 0,
  }, { onConflict: 'tenant_id,resource,partition_key' })

  if (isMissingCheckpointTable(error)) return
  if (error) throw checkpointError(`restart ${drain.resource}`, error)
}

export async function loadIntegrationContinuations(
  client: AdminClient,
  tenantId: string,
  cycleStartedAt: string,
): Promise<Map<number, StoredIntegrationContinuation>> {
  const { data, error } = await client
    .from('sendcloud_sync_checkpoints')
    .select('partition_key, continuation_url, window_ends_at, has_more, consecutive_failures, updated_at')
    .eq('tenant_id', tenantId)
    .eq('resource', 'integration_shipments')
    .eq('has_more', true)

  if (isMissingCheckpointTable(error)) return new Map()
  if (error) throw checkpointError('load integration_shipments', error)

  const checkpoints = new Map<number, StoredIntegrationContinuation>()
  for (const row of data || []) {
    const integrationId = Number(row.partition_key)
    if (!Number.isSafeInteger(integrationId) || !row.continuation_url || !row.window_ends_at) {
      throw new Error(`Invalid persisted integration checkpoint for tenant ${tenantId}`)
    }
    if (resumeResetReason(row.updated_at, cycleStartedAt, row.consecutive_failures)) continue
    checkpoints.set(integrationId, {
      continuationUrl: row.continuation_url,
      snapshotStartedAt: row.window_ends_at,
      failureCount: row.consecutive_failures,
    })
  }
  return checkpoints
}

export function integrationContinuation(
  integrationId: number,
  cycleStartedAt: string,
  stored?: StoredIntegrationContinuation,
): IntegrationContinuation {
  return {
    integrationId,
    continuationUrl: stored?.continuationUrl,
    snapshotStartedAt: stored?.snapshotStartedAt || cycleStartedAt,
    resuming: Boolean(stored),
    failureCount: stored?.failureCount || 0,
  }
}

export async function persistIntegrationContinuation(
  client: AdminClient,
  tenantId: string,
  checkpoint: IntegrationContinuation,
  continuation: { hasMore: boolean; nextUrl?: string },
): Promise<void> {
  const nextUrl: string | null = continuation.hasMore
    ? (continuation.nextUrl ?? null)
    : null
  if (continuation.hasMore && !nextUrl) {
    throw new Error(`Missing next URL for integration ${checkpoint.integrationId}`)
  }

  const { error } = await client.from('sendcloud_sync_checkpoints').upsert({
    tenant_id: tenantId,
    resource: 'integration_shipments',
    partition_key: String(checkpoint.integrationId),
    watermark: null,
    cursor: null,
    continuation_url: nextUrl,
    window_ends_at: continuation.hasMore ? checkpoint.snapshotStartedAt : null,
    has_more: continuation.hasMore,
    consecutive_failures: 0,
  }, { onConflict: 'tenant_id,resource,partition_key' })

  if (isMissingCheckpointTable(error)) return
  if (error) throw checkpointError('persist integration_shipments', error)
}

export async function recordCheckpointFailure(
  client: AdminClient,
  tenantId: string,
  resource: CheckpointResource,
  partitionKey: string,
  currentFailureCount: number,
): Promise<void> {
  const { error } = await client
    .from('sendcloud_sync_checkpoints')
    .update({ consecutive_failures: currentFailureCount + 1 })
    .eq('tenant_id', tenantId)
    .eq('resource', resource)
    .eq('partition_key', partitionKey)

  if (isMissingCheckpointTable(error)) return
  if (error) throw checkpointError(`record failure ${resource}`, error)
}
