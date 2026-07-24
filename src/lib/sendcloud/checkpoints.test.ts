import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/types/database'
import {
  integrationContinuation,
  isAnomalousEmptyResume,
  loadIncrementalDrain,
  loadIntegrationContinuations,
  persistIncrementalDrain,
  persistIntegrationContinuation,
  recordCheckpointFailure,
  restartIncrementalDrain,
} from './checkpoints'

type AdminClient = SupabaseClient<Database>

function selectClient(data: unknown, error: unknown = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  return {
    client: { from: vi.fn().mockReturnValue(builder) } as unknown as AdminClient,
    builder,
  }
}

function listClient(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error })
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    then: result.then.bind(result),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  return { client: { from: vi.fn().mockReturnValue(builder) } as unknown as AdminClient }
}

function upsertClient(error: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error })
  return {
    client: { from: vi.fn().mockReturnValue({ upsert }) } as unknown as AdminClient,
    upsert,
  }
}

function updateClient(error: unknown = null) {
  const result = Promise.resolve({ error })
  const builder = {
    update: vi.fn(),
    eq: vi.fn(),
    then: result.then.bind(result),
  }
  builder.update.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  return {
    client: { from: vi.fn().mockReturnValue(builder) } as unknown as AdminClient,
    builder,
  }
}

describe('Sendcloud persistent checkpoints', () => {
  it('starts a new incremental window from the fallback watermark', async () => {
    const { client } = selectClient(null)

    await expect(loadIncrementalDrain(
      client,
      'tenant-1',
      'returns',
      '2026-07-13T08:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
    )).resolves.toEqual({
      resource: 'returns',
      watermark: '2026-07-13T08:00:00.000Z',
      windowEndsAt: '2026-07-13T09:00:00.000Z',
      resuming: false,
      failureCount: 0,
    })
  })

  it('bootstraps from sync_runs when migration 00095 is not deployed yet', async () => {
    const { client } = selectClient(null, {
      code: '42P01',
      message: 'relation sendcloud_sync_checkpoints does not exist',
    })

    await expect(loadIncrementalDrain(
      client,
      'tenant-1',
      'parcels',
      '2026-07-13T08:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
    )).resolves.toMatchObject({
      watermark: '2026-07-13T08:00:00.000Z',
      resuming: false,
      failureCount: 0,
    })
  })

  it('degrades gracefully for the real PostgREST missing-table response', async () => {
    const { client } = selectClient(null, {
      code: 'PGRST205',
      message: "Could not find the table 'public.sendcloud_sync_checkpoints' in the schema cache",
    })

    await expect(loadIncrementalDrain(
      client,
      'tenant-1',
      'parcels',
      '2026-07-13T08:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
    )).resolves.toMatchObject({
      watermark: '2026-07-13T08:00:00.000Z',
      resuming: false,
    })
  })

  it('does not swallow PGRST205 for a different missing relation', async () => {
    const { client } = selectClient(null, {
      code: 'PGRST205',
      message: "Could not find the table 'public.tenant_settings' in the schema cache",
    })

    await expect(loadIncrementalDrain(
      client,
      'tenant-1',
      'parcels',
      '2026-07-13T08:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
    )).rejects.toThrow('tenant_settings')
  })

  it('keeps permission errors on the checkpoint table fatal', async () => {
    const { client } = selectClient(null, {
      code: '42501',
      message: 'permission denied for table sendcloud_sync_checkpoints',
    })

    await expect(loadIncrementalDrain(
      client,
      'tenant-1',
      'returns',
      '2026-07-13T08:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
    )).rejects.toThrow('permission denied')
  })

  it('uses no integration continuation when migration 00095 is missing', async () => {
    const { client } = listClient(null, {
      code: '42P01',
      message: 'relation sendcloud_sync_checkpoints does not exist',
    })

    await expect(loadIntegrationContinuations(
      client,
      'tenant-1',
      '2026-07-13T09:00:00.000Z',
    )).resolves.toEqual(new Map())
  })

  it('drops a stale integration continuation so the next snapshot restarts at page one', async () => {
    const { client } = listClient([{
      partition_key: '7',
      continuation_url: 'https://panel.sendcloud.sc/api/v2/integrations/7/shipments?page=3',
      window_ends_at: '2026-07-13T07:00:00.000Z',
      has_more: true,
      consecutive_failures: 0,
      updated_at: '2026-07-13T07:59:59.000Z',
    }])

    await expect(loadIntegrationContinuations(
      client,
      'tenant-1',
      '2026-07-13T10:00:00.000Z',
    )).resolves.toEqual(new Map())
  })

  it('keeps non-migration database errors fatal', async () => {
    const { client } = selectClient(null, { code: '57014', message: 'statement timeout' })

    await expect(loadIncrementalDrain(
      client,
      'tenant-1',
      'returns',
      '2026-07-13T08:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
    )).rejects.toThrow('statement timeout')
  })

  it('keeps the bounded sync running when checkpoint persistence sees 42P01', async () => {
    const { client } = upsertClient({
      code: '42P01',
      message: 'relation sendcloud_sync_checkpoints does not exist',
    })

    await expect(persistIncrementalDrain(client, 'tenant-1', {
      resource: 'parcels',
      watermark: '2026-07-13T08:00:00.000Z',
      windowEndsAt: '2026-07-13T09:00:00.000Z',
      resuming: false,
      failureCount: 0,
    }, { hasMore: false })).resolves.toBe('2026-07-13T09:00:00.000Z')
  })

  it('resumes a capped window without advancing its watermark', async () => {
    const { client } = selectClient({
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: 'page-3',
      window_ends_at: '2026-07-13T09:00:00.000Z',
      has_more: true,
      consecutive_failures: 0,
      updated_at: '2026-07-13T09:59:00.000Z',
    })

    const drain = await loadIncrementalDrain(
      client,
      'tenant-1',
      'parcels',
      'ignored',
      '2026-07-13T10:00:00.000Z',
    )

    expect(drain).toMatchObject({
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: 'page-3',
      windowEndsAt: '2026-07-13T09:00:00.000Z',
      resuming: true,
      failureCount: 0,
    })
  })

  it('abandons a resume cursor older than two hours without advancing the watermark', async () => {
    const { client } = selectClient({
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: 'expired-page',
      window_ends_at: '2026-07-13T09:00:00.000Z',
      has_more: true,
      consecutive_failures: 0,
      updated_at: '2026-07-13T07:59:59.000Z',
    })

    await expect(loadIncrementalDrain(
      client,
      'tenant-1',
      'returns',
      'ignored',
      '2026-07-13T10:00:00.000Z',
    )).resolves.toEqual({
      resource: 'returns',
      watermark: '2026-07-13T08:00:00.000Z',
      windowEndsAt: '2026-07-13T10:00:00.000Z',
      resuming: false,
      failureCount: 0,
      resetReason: 'stale',
    })
  })

  it('abandons a cursor after three consecutive resume failures', async () => {
    const { client } = selectClient({
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: 'failing-page',
      window_ends_at: '2026-07-13T09:00:00.000Z',
      has_more: true,
      consecutive_failures: 3,
      updated_at: '2026-07-13T09:59:00.000Z',
    })

    const drain = await loadIncrementalDrain(
      client,
      'tenant-1',
      'parcels',
      'ignored',
      '2026-07-13T10:00:00.000Z',
    )

    expect(drain).toMatchObject({
      watermark: '2026-07-13T08:00:00.000Z',
      resuming: false,
      resetReason: 'repeated_failures',
    })
    expect(drain.cursor).toBeUndefined()
  })

  it('increments only the single failed checkpoint row', async () => {
    const { client, builder } = updateClient()

    await recordCheckpointFailure(client, 'tenant-1', 'returns', '', 1)

    expect(builder.update).toHaveBeenCalledWith({ consecutive_failures: 2 })
    expect(builder.eq.mock.calls).toEqual([
      ['tenant_id', 'tenant-1'],
      ['resource', 'returns'],
      ['partition_key', ''],
    ])
  })

  it('persists a partial cursor while keeping the previous watermark', async () => {
    const { client, upsert } = upsertClient()
    const watermark = await persistIncrementalDrain(client, 'tenant-1', {
      resource: 'returns',
      watermark: '2026-07-13T08:00:00.000Z',
      windowEndsAt: '2026-07-13T09:00:00.000Z',
      resuming: false,
      failureCount: 0,
    }, { hasMore: true, nextCursor: 'page-2' })

    expect(watermark).toBe('2026-07-13T08:00:00.000Z')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: 'page-2',
      window_ends_at: '2026-07-13T09:00:00.000Z',
      has_more: true,
    }), { onConflict: 'tenant_id,resource,partition_key' })
  })

  it('advances the watermark only after the drain is complete', async () => {
    const { client, upsert } = upsertClient()
    const watermark = await persistIncrementalDrain(client, 'tenant-1', {
      resource: 'parcels',
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: 'page-3',
      windowEndsAt: '2026-07-13T09:00:00.000Z',
      resuming: true,
      failureCount: 0,
    }, { hasMore: false })

    expect(watermark).toBe('2026-07-13T09:00:00.000Z')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      watermark: '2026-07-13T09:00:00.000Z',
      cursor: null,
      window_ends_at: null,
      has_more: false,
    }), { onConflict: 'tenant_id,resource,partition_key' })
  })

  it('restarts an anomalously empty resume at the previous watermark', async () => {
    const drain = {
      resource: 'returns' as const,
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: 'page-3',
      windowEndsAt: '2026-07-13T09:00:00.000Z',
      resuming: true,
      failureCount: 0,
    }
    const { client, upsert } = upsertClient()

    expect(isAnomalousEmptyResume(drain, 0)).toBe(true)
    await restartIncrementalDrain(client, 'tenant-1', drain)

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: null,
      window_ends_at: null,
      has_more: false,
    }), { onConflict: 'tenant_id,resource,partition_key' })
  })

  it('keeps an integration continuation separate from incremental watermarks', async () => {
    const checkpoint = integrationContinuation(7, '2026-07-13T09:00:00.000Z')
    const { client, upsert } = upsertClient()

    await persistIntegrationContinuation(client, 'tenant-1', checkpoint, {
      hasMore: true,
      nextUrl: 'https://panel.sendcloud.sc/api/v2/integrations/7/shipments?page=3',
    })

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'integration_shipments',
      partition_key: '7',
      watermark: null,
      cursor: null,
      has_more: true,
    }), { onConflict: 'tenant_id,resource,partition_key' })
  })
})
