/**
 * Regression tests for bundle decomposition in calculateSKUMetrics.
 *
 * Critical bug history: the app previously counted Shopify line items instead of
 * physical products. When a bundle SKU (e.g. BU-DUO = 2x candles) was sold once,
 * consumption was recorded as 1 bundle instead of 2 physical candles — which
 * broke stock projections.
 *
 * These tests verify that the client-side helper in `stock.ts` decomposes
 * bundle SKU consumption into its components multiplied by qty_component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client factory
vi.mock('@/lib/supabase/untyped', () => ({
  getServerDb: vi.fn(),
}))

import { calculateSKUMetrics } from './stock'
import { getServerDb } from '@/lib/supabase/untyped'

const mockGetServerDb = getServerDb as ReturnType<typeof vi.fn>

/**
 * Build a mock Supabase client that supports the parallel queries performed
 * by calculateSKUMetrics:
 *   - from('skus').select(...).eq(...).eq(...)  → promise-like with skus
 *   - from('bundles').select(...).eq(...)       → promise-like with bundles
 *   - rpc('get_sku_consumption_metrics', ...)   → promise
 *   - from('inbound_restock').select(...).eq... → promise-like with restocks
 */
function createMockSupabase(opts: {
  skus: unknown[]
  bundles: unknown[]
  consumption: unknown[]
  restocks?: unknown[]
}) {
  const { skus, bundles, consumption, restocks = [] } = opts

  const chainable = (data: unknown) => {
    const obj: Record<string, unknown> = {}
    obj.select = vi.fn(() => obj)
    obj.eq = vi.fn(() => obj)
    obj.gte = vi.fn(() => obj)
    obj.lte = vi.fn(() => obj)
    // thenable so `await query` resolves with { data, error }
    obj.then = (resolve: (value: unknown) => void) =>
      resolve({ data, error: null })
    return obj
  }

  return {
    from: vi.fn((table: string) => {
      if (table === 'skus') return chainable(skus)
      if (table === 'bundles') return chainable(bundles)
      if (table === 'inbound_restock') return chainable(restocks)
      return chainable([])
    }),
    rpc: vi.fn().mockResolvedValue({ data: consumption, error: null }),
  }
}

describe('calculateSKUMetrics — bundle decomposition (regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts 1:1 consumption for non-bundle SKUs', async () => {
    mockGetServerDb.mockResolvedValue(
      createMockSupabase({
        skus: [
          {
            id: 'sku-candle',
            sku_code: 'FLRN-CANDLE-001',
            name: 'Vanilla Candle',
            stock_snapshots: [{ qty_current: 50 }],
          },
        ],
        bundles: [], // no bundles
        consumption: [
          // 10 candles shipped in the last 90 days, 4 in the last 30
          { sku_id: 'sku-candle', total_qty_90d: 10, total_qty_30d: 4 },
        ],
      }),
    )

    const metrics = await calculateSKUMetrics('tenant-1')

    expect(metrics).toHaveLength(1)
    expect(metrics[0].sku_id).toBe('sku-candle')
    expect(metrics[0].consumption_30d).toBe(4)
    expect(metrics[0].consumption_90d).toBe(10)
  })

  it('decomposes bundle consumption into components multiplied by qty_component', async () => {
    // A "DUO" bundle = 2x candle-A + 1x candle-B
    // If 3 DUO bundles are shipped, physical consumption should be:
    //   candle-A: 3 * 2 = 6
    //   candle-B: 3 * 1 = 3
    mockGetServerDb.mockResolvedValue(
      createMockSupabase({
        skus: [
          {
            id: 'sku-candle-a',
            sku_code: 'FLRN-CANDLE-A',
            name: 'Candle A',
            stock_snapshots: [{ qty_current: 20 }],
          },
          {
            id: 'sku-candle-b',
            sku_code: 'FLRN-CANDLE-B',
            name: 'Candle B',
            stock_snapshots: [{ qty_current: 15 }],
          },
        ],
        bundles: [
          {
            bundle_sku_id: 'sku-bundle-duo',
            bundle_components: [
              { component_sku_id: 'sku-candle-a', qty_component: 2 },
              { component_sku_id: 'sku-candle-b', qty_component: 1 },
            ],
          },
        ],
        consumption: [
          // 3 bundles sold in last 90d, 1 in last 30d
          { sku_id: 'sku-bundle-duo', total_qty_90d: 3, total_qty_30d: 1 },
        ],
      }),
    )

    const metrics = await calculateSKUMetrics('tenant-1')
    const candleA = metrics.find((m) => m.sku_id === 'sku-candle-a')
    const candleB = metrics.find((m) => m.sku_id === 'sku-candle-b')

    expect(candleA).toBeDefined()
    expect(candleB).toBeDefined()
    // Regression guard: must NOT count 3 (line items), must count physical decomposition
    expect(candleA!.consumption_90d).toBe(6) // 3 bundles * 2/bundle
    expect(candleA!.consumption_30d).toBe(2) // 1 bundle  * 2/bundle
    expect(candleB!.consumption_90d).toBe(3) // 3 bundles * 1/bundle
    expect(candleB!.consumption_30d).toBe(1) // 1 bundle  * 1/bundle
  })

  it('sums direct consumption and bundle-derived consumption for the same component SKU', async () => {
    // candle-A is sold 5 times directly AND 2 DUO bundles (=4 candle-A) are sold.
    // Physical candle-A consumption should be 5 + 4 = 9, not 5 + 2 = 7.
    mockGetServerDb.mockResolvedValue(
      createMockSupabase({
        skus: [
          {
            id: 'sku-candle-a',
            sku_code: 'FLRN-CANDLE-A',
            name: 'Candle A',
            stock_snapshots: [{ qty_current: 50 }],
          },
        ],
        bundles: [
          {
            bundle_sku_id: 'sku-bundle-duo',
            bundle_components: [
              { component_sku_id: 'sku-candle-a', qty_component: 2 },
            ],
          },
        ],
        consumption: [
          { sku_id: 'sku-candle-a', total_qty_90d: 5, total_qty_30d: 5 },
          { sku_id: 'sku-bundle-duo', total_qty_90d: 2, total_qty_30d: 2 },
        ],
      }),
    )

    const metrics = await calculateSKUMetrics('tenant-1')
    const candleA = metrics.find((m) => m.sku_id === 'sku-candle-a')

    expect(candleA).toBeDefined()
    // 5 direct + (2 bundles * 2 qty_component) = 9 physical units
    expect(candleA!.consumption_90d).toBe(9)
    expect(candleA!.consumption_30d).toBe(9)
  })
})
