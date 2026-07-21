import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '@/types/database'
import {
  integrationContinuation,
  loadIncrementalDrain,
  persistIncrementalDrain,
  persistIntegrationContinuation,
} from './checkpoints'

type AdminClient = SupabaseClient<Database>

function selectClient(data: unknown) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  return {
    client: { from: vi.fn().mockReturnValue(builder) } as unknown as AdminClient,
    builder,
  }
}

function upsertClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  return {
    client: { from: vi.fn().mockReturnValue({ upsert }) } as unknown as AdminClient,
    upsert,
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
    })
  })

  it('resumes a capped window without advancing its watermark', async () => {
    const { client } = selectClient({
      watermark: '2026-07-13T08:00:00.000Z',
      cursor: 'page-3',
      window_ends_at: '2026-07-13T09:00:00.000Z',
      has_more: true,
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
    })
  })

  it('persists a partial cursor while keeping the previous watermark', async () => {
    const { client, upsert } = upsertClient()
    const watermark = await persistIncrementalDrain(client, 'tenant-1', {
      resource: 'returns',
      watermark: '2026-07-13T08:00:00.000Z',
      windowEndsAt: '2026-07-13T09:00:00.000Z',
      resuming: false,
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
    }, { hasMore: false })

    expect(watermark).toBe('2026-07-13T09:00:00.000Z')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      watermark: '2026-07-13T09:00:00.000Z',
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
