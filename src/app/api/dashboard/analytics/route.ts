import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant } from '@/lib/supabase/auth'

// In-memory cache: key = tenantId:from:to, value = { data, timestamp }
const analyticsCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL_MS = 60_000 // 60 seconds

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

export async function GET(request: Request) {
  try {
    const tenantId = await requireTenant()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Check in-memory cache
    const cacheKey = `${tenantId}:${from || ''}:${to || ''}`
    const cached = analyticsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120', 'X-Cache': 'HIT' },
      })
    }

    const adminClient = createAdminClient()

    // Default to last 12 months if no dates provided
    const endDate = to ? new Date(to) : new Date()
    // Ensure endDate includes the full last day (23:59:59.999 UTC)
    // new Date('2025-12-31') gives midnight, excluding that day's shipments
    if (to) {
      endDate.setUTCHours(23, 59, 59, 999)
    }
    const startDate = from ? new Date(from) : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)

    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const pageSize = 1000

    // ===========================================
    // ALL 4 SECTIONS IN PARALLEL (was sequential before)
    // ===========================================
    const [costTrendResult, carrierResult, stockResult, skuSalesResult] = await Promise.all([
      // --- 1. COST TREND ---
      (async () => {
        const { data: monthlyShipments, error: monthlyError } = await adminClient.rpc(
          'analytics_monthly_shipments' as never,
          {
            p_tenant_id: tenantId,
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString(),
          } as never
        )

        if (!monthlyError && monthlyShipments) {
          return (monthlyShipments as MonthlyData[]) || []
        }

        // Fallback: direct queries in parallel
        const [allShipments, allClaims] = await Promise.all([
          (async () => {
            const results: { shipped_at: string; computed_cost_eur: number | null }[] = []
            let offset = 0
            let hasMore = true
            while (hasMore) {
              const { data, error } = await adminClient
                .from('shipments')
                .select('shipped_at, computed_cost_eur')
                .eq('tenant_id', tenantId)
                .eq('is_return', false)
                .gte('shipped_at', startDate.toISOString())
                .lte('shipped_at', endDate.toISOString())
                .range(offset, offset + pageSize - 1)
              if (error) throw error
              if (data && data.length > 0) {
                results.push(...data)
                offset += pageSize
                hasMore = data.length === pageSize
              } else {
                hasMore = false
              }
            }
            return results
          })(),
          (async () => {
            const { data } = await adminClient
              .from('claims')
              .select('decided_at, indemnity_eur')
              .eq('tenant_id', tenantId)
              .eq('status', 'indemnisee')
              .gte('decided_at', startDate.toISOString())
              .lte('decided_at', endDate.toISOString())
            return data
          })(),
        ])

        const shipmentsByMonth = new Map<string, { count: number; cost: number }>()
        for (const s of allShipments) {
          if (!s.shipped_at) continue
          const d = new Date(s.shipped_at)
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
          const existing = shipmentsByMonth.get(key) || { count: 0, cost: 0 }
          existing.count++
          existing.cost += Number(s.computed_cost_eur) || 0
          shipmentsByMonth.set(key, existing)
        }

        const claimsByMonth = new Map<string, { count: number; indemnity: number }>()
        for (const c of (allClaims || []) as { decided_at: string | null; indemnity_eur: number | null }[]) {
          if (!c.decided_at) continue
          const d = new Date(c.decided_at)
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
          const existing = claimsByMonth.get(key) || { count: 0, indemnity: 0 }
          existing.count++
          existing.indemnity += Number(c.indemnity_eur) || 0
          claimsByMonth.set(key, existing)
        }

        const monthlyData: MonthlyData[] = []
        const sYear = startDate.getFullYear()
        const sMonth = startDate.getMonth()
        const eYear = endDate.getFullYear()
        const eMonth = endDate.getMonth()
        const totalMonths = (eYear - sYear) * 12 + (eMonth - sMonth) + 1

        for (let i = 0; i < totalMonths; i++) {
          const date = new Date(sYear, sMonth + i, 1)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          const shipData = shipmentsByMonth.get(monthKey) || { count: 0, cost: 0 }
          const claimData = claimsByMonth.get(monthKey) || { count: 0, indemnity: 0 }
          monthlyData.push({
            month: monthKey,
            shipments: shipData.count,
            cost: Math.round(shipData.cost * 100) / 100,
            claims: claimData.count,
            indemnity: Math.round(claimData.indemnity * 100) / 100,
          })
        }
        return monthlyData
      })(),

      // --- 2. CARRIER PERFORMANCE (last 90 days) ---
      (async () => {
        const [recentShipments, recentClaims] = await Promise.all([
          (async () => {
            const results: { carrier: string; computed_cost_eur: number | null }[] = []
            let offset = 0
            let hasMore = true
            while (hasMore) {
              const { data, error } = await adminClient
                .from('shipments')
                .select('carrier, computed_cost_eur')
                .eq('tenant_id', tenantId)
                .eq('is_return', false)
                .gte('shipped_at', ninetyDaysAgo.toISOString())
                .range(offset, offset + pageSize - 1)
              if (error) throw error
              if (data && data.length > 0) {
                results.push(...data)
                offset += pageSize
                hasMore = data.length === pageSize
              } else {
                hasMore = false
              }
            }
            return results
          })(),
          (async () => {
            const { data } = await adminClient
              .from('claims')
              .select('shipment_id, shipments!inner(carrier)')
              .eq('tenant_id', tenantId)
              .gte('opened_at', ninetyDaysAgo.toISOString())
            return data
          })(),
        ])

        const carrierMap = new Map<string, { shipments: number; cost: number; claims: number }>()
        for (const shipment of recentShipments) {
          const carrier = (shipment.carrier || 'unknown').toLowerCase()
          const existing = carrierMap.get(carrier) || { shipments: 0, cost: 0, claims: 0 }
          carrierMap.set(carrier, {
            shipments: existing.shipments + 1,
            cost: existing.cost + (Number(shipment.computed_cost_eur) || 0),
            claims: existing.claims,
          })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const claim of (recentClaims || []) as any[]) {
          const shipment = claim.shipments
          const carrier = (shipment?.carrier || 'unknown').toLowerCase()
          const existing = carrierMap.get(carrier)
          if (existing) existing.claims++
        }

        return Array.from(carrierMap.entries())
          .map(([carrier, stats]) => ({
            carrier,
            shipments: stats.shipments,
            totalCost: Math.round(stats.cost * 100) / 100,
            avgCost: stats.shipments > 0 ? Math.round((stats.cost / stats.shipments) * 100) / 100 : 0,
            claims: stats.claims,
            claimRate: stats.shipments > 0 ? Math.round((stats.claims / stats.shipments) * 10000) / 100 : 0,
          }))
          .sort((a, b) => b.shipments - a.shipments)
      })(),

      // --- 3. STOCK FORECAST (5 parallel queries) ---
      (async () => {
        const [skusRes, stockRes, bundlesRes, bundleCompRes, itemsRes] = await Promise.all([
          adminClient.from('skus').select('id, sku_code, name, alert_threshold').eq('tenant_id', tenantId).eq('active', true),
          adminClient.from('stock_snapshots').select('sku_id, qty_current').eq('tenant_id', tenantId),
          adminClient.from('bundles').select('id, bundle_sku_id').eq('tenant_id', tenantId),
          adminClient.from('bundle_components').select('bundle_id, component_sku_id, qty_component').eq('tenant_id', tenantId),
          adminClient.from('shipment_items').select('sku_id, qty, shipments!inner(shipped_at)').eq('tenant_id', tenantId).gte('shipments.shipped_at' as never, ninetyDaysAgo.toISOString()),
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skus = (skusRes.data || []) as any[]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bundlesList = (bundlesRes.data || []) as any[]
        const bundleIdToSkuIdMap = new Map<string, string>()
        for (const b of bundlesList) bundleIdToSkuIdMap.set(b.id, b.bundle_sku_id)
        const bundleSkuIds = new Set(bundlesList.map((b: { bundle_sku_id: string }) => b.bundle_sku_id))

        const bundleDecompositionMap = new Map<string, Array<{ component_sku_id: string; qty_component: number }>>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const comp of (bundleCompRes.data || []) as any[]) {
          const bundleSkuId = bundleIdToSkuIdMap.get(comp.bundle_id)
          if (!bundleSkuId) continue
          const components = bundleDecompositionMap.get(bundleSkuId) || []
          components.push({ component_sku_id: comp.component_sku_id, qty_component: comp.qty_component || 1 })
          bundleDecompositionMap.set(bundleSkuId, components)
        }

        const stockMap = new Map<string, number>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const snapshot of (stockRes.data || []) as any[]) stockMap.set(snapshot.sku_id, snapshot.qty_current || 0)

        const consumptionMap = new Map<string, number>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const item of (itemsRes.data || []) as any[]) {
          const existing = consumptionMap.get(item.sku_id) || 0
          consumptionMap.set(item.sku_id, existing + (item.qty || 0))
        }

        return skus
          .filter((sku: { id: string }) => !bundleSkuIds.has(sku.id))
          .filter((sku: { sku_code: string }) => !sku.sku_code.toUpperCase().includes('BU-'))
          .map((sku: { id: string; sku_code: string; name: string; alert_threshold: number | null }) => {
            const currentStock = stockMap.get(sku.id) || 0
            const totalConsumption = consumptionMap.get(sku.id) || 0
            const avgDailyConsumption = totalConsumption / 90
            let daysRemaining: number | null = null
            let estimatedStockout: string | null = null
            if (avgDailyConsumption > 0) {
              daysRemaining = Math.floor(currentStock / avgDailyConsumption)
              const stockoutDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000)
              estimatedStockout = stockoutDate.toISOString().split('T')[0]
            }
            return {
              sku_id: sku.id, sku_code: sku.sku_code, name: sku.name,
              current_stock: currentStock,
              avg_daily_consumption: Math.round(avgDailyConsumption * 100) / 100,
              days_remaining: daysRemaining, estimated_stockout: estimatedStockout,
              alert_threshold: sku.alert_threshold || 10,
            }
          })
          .filter((sku: StockForecast) => sku.current_stock > 0 || sku.avg_daily_consumption > 0)
          .sort((a: StockForecast, b: StockForecast) => {
            if (a.days_remaining === null && b.days_remaining === null) return a.current_stock - b.current_stock
            if (a.days_remaining === null) return 1
            if (b.days_remaining === null) return -1
            return a.days_remaining - b.days_remaining
          })
      })(),

      // --- 4. SKU SALES ---
      (async () => {
        const { data: skuSalesRaw, error: skuSalesError } = await adminClient.rpc(
          'analytics_sku_sales' as never,
          { p_tenant_id: tenantId, p_start_date: startDate.toISOString(), p_end_date: endDate.toISOString() } as never
        )

        if (!skuSalesError && skuSalesRaw) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return ((skuSalesRaw || []) as any[]).map((row: { sku_id: string; sku_code: string; name: string; quantity_sold: number }) => ({
            sku_id: row.sku_id, sku_code: row.sku_code, name: row.name, quantity_sold: Number(row.quantity_sold),
          }))
        }

        console.error('[Analytics] SKU sales RPC error, using fallback:', skuSalesError)
        const allItems: { sku_id: string; qty: number; skus: { sku_code: string; name: string }; shipments: { shipped_at: string } }[] = []
        let offset = 0
        let hasMore = true
        while (hasMore) {
          const { data, error } = await adminClient
            .from('shipment_items')
            .select('sku_id, qty, skus!inner(sku_code, name), shipments!inner(shipped_at)')
            .eq('tenant_id', tenantId)
            .gte('shipments.shipped_at' as never, startDate.toISOString())
            .lte('shipments.shipped_at' as never, endDate.toISOString())
            .range(offset, offset + pageSize - 1)
          if (error) { console.error('[Analytics] SKU sales fallback query error:', error); break }
          if (data && data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            allItems.push(...(data as any[]))
            offset += pageSize
            hasMore = data.length === pageSize
          } else { hasMore = false }
        }

        const salesMap = new Map<string, { sku_code: string; name: string; quantity_sold: number }>()
        for (const item of allItems) {
          if (!item.sku_id) continue
          const existing = salesMap.get(item.sku_id)
          if (existing) { existing.quantity_sold += Number(item.qty) || 0 }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          else { const skuInfo = item.skus as any; salesMap.set(item.sku_id, { sku_code: skuInfo?.sku_code || '', name: skuInfo?.name || '', quantity_sold: Number(item.qty) || 0 }) }
        }
        return Array.from(salesMap.entries())
          .map(([sku_id, info]) => ({ sku_id, sku_code: info.sku_code, name: info.name, quantity_sold: info.quantity_sold }))
          .sort((a, b) => b.quantity_sold - a.quantity_sold)
      })(),
    ])

    const monthlyData = costTrendResult
    const carrierStats = carrierResult
    const stockForecast = stockResult
    const skuSalesAll: SkuSalesData[] = skuSalesResult
    const skuSalesData: SkuSalesData[] = skuSalesAll.slice(0, 10)
    const totalSkusSold = skuSalesAll.length
    const totalQuantitySold = skuSalesAll.reduce((sum: number, s: { quantity_sold: number }) => sum + s.quantity_sold, 0)

    // ===========================================
    // 5. SUMMARY STATS
    // ===========================================
    const emptyMonth = { month: '', shipments: 0, cost: 0, claims: 0, indemnity: 0 }
    const currentMonthData = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : emptyMonth
    const previousMonthData = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null

    const costTrend = previousMonthData && previousMonthData.cost > 0
      ? Math.round(((currentMonthData.cost - previousMonthData.cost) / previousMonthData.cost) * 100)
      : 0

    const shipmentsTrend = previousMonthData && previousMonthData.shipments > 0
      ? Math.round(((currentMonthData.shipments - previousMonthData.shipments) / previousMonthData.shipments) * 100)
      : 0

    const criticalStockCount = stockForecast.filter((s: StockForecast) =>
      s.days_remaining !== null && s.days_remaining < 30
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

    // Store in cache
    analyticsCache.set(cacheKey, { data: responseData, timestamp: Date.now() })
    // Evict old entries (keep max 50)
    if (analyticsCache.size > 50) {
      const oldest = Array.from(analyticsCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
      if (oldest) analyticsCache.delete(oldest[0])
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
