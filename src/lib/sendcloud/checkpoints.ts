import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type IncrementalResource = 'parcels' | 'returns'

export interface IncrementalDrain {
  resource: IncrementalResource
  watermark: string
  cursor?: string
  windowEndsAt: string
  resuming: boolean
}

export interface IntegrationContinuation {
  integrationId: number
  continuationUrl?: string
  snapshotStartedAt: string
  resuming: boolean
}

type AdminClient = SupabaseClient<Database>

function checkpointError(action: string, error: { message: string }): Error {
  return new Error(`Sendcloud checkpoint ${action}: ${error.message}`)
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
    .select('watermark, cursor, window_ends_at, has_more')
    .eq('tenant_id', tenantId)
    .eq('resource', resource)
    .eq('partition_key', '')
    .maybeSingle()

  if (error) throw checkpointError(`load ${resource}`, error)

  if (data?.has_more) {
    if (!data.watermark || !data.cursor || !data.window_ends_at) {
      throw new Error(`Invalid persisted ${resource} checkpoint for tenant ${tenantId}`)
    }
    return {
      resource,
      watermark: data.watermark,
      cursor: data.cursor,
      windowEndsAt: data.window_ends_at,
      resuming: true,
    }
  }

  return {
    resource,
    watermark: data?.watermark || fallbackWatermark,
    windowEndsAt: cycleStartedAt,
    resuming: false,
  }
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
  }, { onConflict: 'tenant_id,resource,partition_key' })

  if (error) throw checkpointError(`persist ${drain.resource}`, error)
  return completedWatermark
}

export async function loadIntegrationContinuations(
  client: AdminClient,
  tenantId: string,
): Promise<Map<number, { continuationUrl: string; snapshotStartedAt: string }>> {
  const { data, error } = await client
    .from('sendcloud_sync_checkpoints')
    .select('partition_key, continuation_url, window_ends_at, has_more')
    .eq('tenant_id', tenantId)
    .eq('resource', 'integration_shipments')
    .eq('has_more', true)

  if (error) throw checkpointError('load integration_shipments', error)

  const checkpoints = new Map<number, { continuationUrl: string; snapshotStartedAt: string }>()
  for (const row of data || []) {
    const integrationId = Number(row.partition_key)
    if (!Number.isSafeInteger(integrationId) || !row.continuation_url || !row.window_ends_at) {
      throw new Error(`Invalid persisted integration checkpoint for tenant ${tenantId}`)
    }
    checkpoints.set(integrationId, {
      continuationUrl: row.continuation_url,
      snapshotStartedAt: row.window_ends_at,
    })
  }
  return checkpoints
}

export function integrationContinuation(
  integrationId: number,
  cycleStartedAt: string,
  stored?: { continuationUrl: string; snapshotStartedAt: string },
): IntegrationContinuation {
  return {
    integrationId,
    continuationUrl: stored?.continuationUrl,
    snapshotStartedAt: stored?.snapshotStartedAt || cycleStartedAt,
    resuming: Boolean(stored),
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
  }, { onConflict: 'tenant_id,resource,partition_key' })

  if (error) throw checkpointError('persist integration_shipments', error)
}
