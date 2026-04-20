import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant } from '@/lib/supabase/auth'

// In-memory cache: key = tenantId:from:to, value = { data, timestamp }
const analyticsCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL_MS = 300_000 // 5 minutes

interface MonthlyData {
  month: string
  shipments: number
  cost: number
  claims: number
  indemnity: number
}

interface CarrierStats {
  carrier: string
  shipments: number
  totalCost: number
  avgCost: number
  claims: number
  claimRate: number
}

interface StockForecast {
  sku_id: string
  sku_code: string
  name: string
  current_stock: number
  avg_daily_consumption: number
  days_remaining: number | null
  estimated_stockout: string | null
  alert_threshold: number
}

interface SkuSalesData {
  sku_id: string
  sku_code: string
  name: string
  quantity_sold: number
}

interface CarrierRpcRow {
  carrier: string
  shipments: number | string
  total_cost: number | string
  avg_cost: number | string
  claims: number | string
  claim_rate: number | string
}

interface SkuMetricRow {
  sku_id: string
  sku_code: string
  name: string
  alert_threshold: number | null
  qty_current: number
  avg_daily_90d: number
  days_remaining: number | null
  is_bundle: boolean
}

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: Request) {
  try {
    const tenantId = await requireTenant()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const cacheKey = `${tenantId}:${from || ''}:${to || ''}`
    const cached = analyticsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
        },
      })
    }

    const adminClient = createAdminClient()

    // Default: last 12 months
    const endDate = to ? new Date(to) : new Date()
    if (to) endDate.setUTCHours(23, 59, 59, 999)
    const startDate = from
      ? new Date(from)
      : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)

    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    // All 4 sections in parallel — every one is now a single RPC / single mat view read.
    const [costTrendResult, carrierResult, stockResult, skuSalesResult] =
      await Promise.all([
        // 1. Cost trend — analytics_monthly_shipments RPC (indexed, fast)
        adminClient
          .rpc('analytics_monthly_shipments' as never, {
            p_tenant_id: tenantId,
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString(),
          } as never)
          .then(({ data, error }) => {
            if (error || !data) return [] as MonthlyData[]
            return (data as MonthlyData[]) || []
          }),

        // 2. Carrier performance — new RPC, aggregated server-side
        adminClient
          .rpc('get_carrier_performance' as never, {
            p_tenant_id: tenantId,
            p_start_date: ninetyDaysAgo.toISOString(),
            p_end_date: now.toISOString(),
          } as never)
          .then(({ data, error }) => {
            if (error || !data) return [] as CarrierStats[]
            return ((data as CarrierRpcRow[]) || []).map((row) => ({
              carrier: row.carrier,
              shipments: toNum(row.shipments),
              totalCost: toNum(row.total_cost),
              avgCost: toNum(row.avg_cost),
              claims: toNum(row.claims),
              claimRate: toNum(row.claim_rate),
            }))
          }),

        // 3. Stock forecast — read directly from mv_sku_metrics (pre-computed)
        adminClient
          .from('mv_sku_metrics' as never)
          .select(
            'sku_id, sku_code, name, alert_threshold, qty_current, avg_daily_90d, days_remaining, is_bundle' as never
          )
          .eq('tenant_id' as never, tenantId)
          .eq('is_bundle' as never, false)
          .then(({ data, error }) => {
            if (error || !data) return [] as StockForecast[]
            return ((data as unknown as SkuMetricRow[]) || [])
              .filter((m) => !m.sku_code.toUpperCase().includes('BU-'))
              .filter((m) => m.qty_current > 0 || m.avg_daily_90d > 0)
              .map((m) => {
                const daysRemaining = m.days_remaining
                const estimatedStockout =
                  daysRemaining !== null
                    ? new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split('T')[0]
                    : null
                return {
                  sku_id: m.sku_id,
                  sku_code: m.sku_code,
                  name: m.name,
                  current_stock: m.qty_current,
                  avg_daily_consumption: m.avg_daily_90d,
                  days_remaining: daysRemaining,
                  estimated_stockout: estimatedStockout,
                  alert_threshold: m.alert_threshold || 10,
                }
              })
              .sort((a, b) => {
                if (a.days_remaining === null && b.days_remaining === null)
                  return a.current_stock - b.current_stock
                if (a.days_remaining === null) return 1
                if (b.days_remaining === null) return -1
                return a.days_remaining - b.days_remaining
              })
          }),

        // 4. SKU sales — analytics_sku_sales RPC
        adminClient
          .rpc('analytics_sku_sales' as never, {
            p_tenant_id: tenantId,
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString(),
          } as never)
          .then(({ data, error }) => {
            if (error || !data) return [] as SkuSalesData[]
            return (
              (data as Array<{
                sku_id: string
                sku_code: string
                name: string
                quantity_sold: number
              }>) || []
            ).map((row) => ({
              sku_id: row.sku_id,
              sku_code: row.sku_code,
              name: row.name,
              quantity_sold: Number(row.quantity_sold),
            }))
          }),
      ])

    const monthlyData = costTrendResult
    const carrierStats = carrierResult
    const stockForecast = stockResult
    const skuSalesAll = skuSalesResult
    const skuSalesData = skuSalesAll.slice(0, 10)
    const totalSkusSold = skuSalesAll.length
    const totalQuantitySold = skuSalesAll.reduce(
      (sum, s) => sum + s.quantity_sold,
      0
    )

    const emptyMonth: MonthlyData = {
      month: '',
      shipments: 0,
      cost: 0,
      claims: 0,
      indemnity: 0,
    }
    const currentMonthData =
      monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : emptyMonth
    const previousMonthData =
      monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null

    const costTrend =
      previousMonthData && previousMonthData.cost > 0
        ? Math.round(
            ((currentMonthData.cost - previousMonthData.cost) /
              previousMonthData.cost) *
              100
          )
        : 0

    const shipmentsTrend =
      previousMonthData && previousMonthData.shipments > 0
        ? Math.round(
            ((currentMonthData.shipments - previousMonthData.shipments) /
              previousMonthData.shipments) *
              100
          )
        : 0

    const criticalStockCount = stockForecast.filter(
      (s) => s.days_remaining !== null && s.days_remaining < 30
    ).length

    const responseData = {
      costTrend: {
        data: monthlyData,
        currentMonth: currentMonthData,
        previousMonth: previousMonthData,
        percentChange: costTrend,
        shipmentsPercentChange: shipmentsTrend,
      },
      carrierPerformance: {
        data: carrierStats,
        totalCarriers: carrierStats.length,
        topCarrier: carrierStats[0] || null,
      },
      stockForecast: {
        data: stockForecast.slice(0, 20),
        criticalCount: criticalStockCount,
        totalTracked: stockForecast.length,
      },
      skuSales: {
        data: skuSalesData,
        totalSkus: totalSkusSold,
        totalQuantity: totalQuantitySold,
      },
      generatedAt: new Date().toISOString(),
    }

    analyticsCache.set(cacheKey, { data: responseData, timestamp: Date.now() })
    if (analyticsCache.size > 50) {
      const oldest = Array.from(analyticsCache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0]
      if (oldest) analyticsCache.delete(oldest[0])
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
