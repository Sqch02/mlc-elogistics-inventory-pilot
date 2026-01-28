import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant } from '@/lib/supabase/auth'

// Fetch shipments for a date range with pagination (bypasses 1000 row limit)
async function fetchShipmentsInRange(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{ id: string; computed_cost_eur: number | null }[]> {
  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient as any
  const allRows: { id: string; computed_cost_eur: number | null }[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await db
      .from('shipments')
      .select('id, computed_cost_eur')
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    if (data && data.length > 0) {
      allRows.push(...data)
      offset += pageSize
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return allRows
}

// Fetch all shipments for carrier stats with pagination
async function fetchRecentShipments(
  tenantId: string,
  sinceDate: Date
): Promise<{ id: string; carrier: string; computed_cost_eur: number | null }[]> {
  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient as any
  const allRows: { id: string; carrier: string; computed_cost_eur: number | null }[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await db
      .from('shipments')
      .select('id, carrier, computed_cost_eur')
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .gte('shipped_at', sinceDate.toISOString())
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    if (data && data.length > 0) {
      allRows.push(...data)
      offset += pageSize
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return allRows
}

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

interface SkuRow {
  id: string
  sku_code: string
  name: string
  alert_threshold: number | null
}

export async function GET(request: Request) {
  try {
    const tenantId = await requireTenant()
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = adminClient as any

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Default to last 12 months if no dates provided
    const endDate = to ? new Date(to) : new Date()
    const startDate = from ? new Date(from) : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)

    const now = new Date()

    // ===========================================
    // 1. COST TREND: Based on date range
    // ===========================================
    const monthlyData: MonthlyData[] = []

    // Calculate months between startDate and endDate
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth()
    const endYear = endDate.getFullYear()
    const endMonth = endDate.getMonth()
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1

    for (let i = 0; i < totalMonths; i++) {
      const date = new Date(startYear, startMonth + i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

      // Get shipments for this month (with pagination to bypass 1000 limit)
      const shipments = await fetchShipmentsInRange(tenantId, startOfMonth, endOfMonth)

      // Get claims decided this month
      const { data: claims } = await supabase
        .from('claims')
        .select('id, indemnity_eur')
        .eq('tenant_id', tenantId)
        .eq('status', 'indemnisee')
        .gte('decided_at', startOfMonth.toISOString())
        .lte('decided_at', endOfMonth.toISOString())

      const shipmentCount = shipments?.length || 0
      const totalCost = shipments?.reduce((sum: number, s: { computed_cost_eur: number | null }) => sum + (Number(s.computed_cost_eur) || 0), 0) || 0
      const claimCount = claims?.length || 0
      const totalIndemnity = claims?.reduce((sum: number, c: { indemnity_eur: number | null }) => sum + (Number(c.indemnity_eur) || 0), 0) || 0

      monthlyData.push({
        month: monthKey,
        shipments: shipmentCount,
        cost: Math.round(totalCost * 100) / 100,
        claims: claimCount,
        indemnity: Math.round(totalIndemnity * 100) / 100,
      })
    }

    // ===========================================
    // 2. CARRIER PERFORMANCE
    // ===========================================
    // Get all shipments from the last 90 days for carrier stats (with pagination)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const recentShipments = await fetchRecentShipments(tenantId, ninetyDaysAgo)

    const { data: recentClaims } = await supabase
      .from('claims')
      .select('shipment_id, shipments!inner(carrier)')
      .eq('tenant_id', tenantId)
      .gte('opened_at', ninetyDaysAgo.toISOString())

    // Group by carrier
    const carrierMap = new Map<string, { shipments: number; cost: number; claims: number }>()

    for (const shipment of recentShipments || []) {
      const carrier = (shipment.carrier || 'unknown').toLowerCase()
      const existing = carrierMap.get(carrier) || { shipments: 0, cost: 0, claims: 0 }
      carrierMap.set(carrier, {
        shipments: existing.shipments + 1,
        cost: existing.cost + (Number(shipment.computed_cost_eur) || 0),
        claims: existing.claims,
      })
    }

    // Add claims count by carrier
    for (const claim of recentClaims || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shipment = claim.shipments as any
      const carrier = (shipment?.carrier || 'unknown').toLowerCase()
      const existing = carrierMap.get(carrier)
      if (existing) {
        existing.claims++
      }
    }

    const carrierStats: CarrierStats[] = Array.from(carrierMap.entries())
      .map(([carrier, stats]) => ({
        carrier,
        shipments: stats.shipments,
        totalCost: Math.round(stats.cost * 100) / 100,
        avgCost: stats.shipments > 0 ? Math.round((stats.cost / stats.shipments) * 100) / 100 : 0,
        claims: stats.claims,
        claimRate: stats.shipments > 0 ? Math.round((stats.claims / stats.shipments) * 10000) / 100 : 0, // percentage
      }))
      .sort((a, b) => b.shipments - a.shipments)

    // ===========================================
    // 3. STOCK FORECAST
    // ===========================================
    // Get all SKUs with their stock
    const { data: skus } = await supabase
      .from('skus')
      .select('id, sku_code, name, alert_threshold')
      .eq('tenant_id', tenantId)
      .eq('active', true)

    const { data: stockSnapshots } = await supabase
      .from('stock_snapshots')
      .select('sku_id, qty_current')
      .eq('tenant_id', tenantId)

    // Get bundle SKU IDs to exclude
    const { data: bundles } = await supabase
      .from('bundles')
      .select('bundle_sku_id')
      .eq('tenant_id', tenantId)

    const bundleSkuIds = new Set((bundles || []).map((b: { bundle_sku_id: string }) => b.bundle_sku_id))

    // Get shipment consumption over last 90 days
    const { data: shipmentItems } = await supabase
      .from('shipment_items')
      .select('sku_id, quantity, shipments!inner(shipped_at)')
      .eq('tenant_id', tenantId)
      .gte('shipments.shipped_at', ninetyDaysAgo.toISOString())

    // Calculate average daily consumption per SKU
    const consumptionMap = new Map<string, number>()
    for (const item of shipmentItems || []) {
      const skuId = item.sku_id
      const existing = consumptionMap.get(skuId) || 0
      consumptionMap.set(skuId, existing + (item.quantity || 0))
    }

    // Build stock snapshots map
    const stockMap = new Map<string, number>()
    for (const snapshot of stockSnapshots || []) {
      stockMap.set(snapshot.sku_id, snapshot.qty_current || 0)
    }

    // Calculate forecast for each SKU
    const stockForecast: StockForecast[] = ((skus || []) as SkuRow[])
      .filter((sku: SkuRow) => !bundleSkuIds.has(sku.id)) // Exclude bundles
      .filter((sku: SkuRow) => !sku.sku_code.toUpperCase().includes('BU-')) // Exclude bundle codes
      .map((sku: SkuRow) => {
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
          sku_id: sku.id,
          sku_code: sku.sku_code,
          name: sku.name,
          current_stock: currentStock,
          avg_daily_consumption: Math.round(avgDailyConsumption * 100) / 100,
          days_remaining: daysRemaining,
          estimated_stockout: estimatedStockout,
          alert_threshold: sku.alert_threshold || 10,
        }
      })
      .filter(sku => sku.current_stock > 0 || sku.avg_daily_consumption > 0) // Only active SKUs
      .sort((a, b) => {
        // Sort by days remaining (null = infinite), then by stock
        if (a.days_remaining === null && b.days_remaining === null) return a.current_stock - b.current_stock
        if (a.days_remaining === null) return 1
        if (b.days_remaining === null) return -1
        return a.days_remaining - b.days_remaining
      })

    // ===========================================
    // 4. SKU SALES (based on date range)
    // ===========================================
    // Get shipment items for the selected date range
    const { data: skuSalesItems } = await supabase
      .from('shipment_items')
      .select('sku_id, quantity, skus!inner(sku_code, name), shipments!inner(shipped_at)')
      .eq('tenant_id', tenantId)
      .gte('shipments.shipped_at', startDate.toISOString())
      .lte('shipments.shipped_at', endDate.toISOString())

    // Aggregate by SKU
    const skuSalesMap = new Map<string, { sku_code: string; name: string; quantity: number }>()
    for (const item of skuSalesItems || []) {
      const skuId = item.sku_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skuInfo = item.skus as any
      const existing = skuSalesMap.get(skuId)
      if (existing) {
        existing.quantity += item.quantity || 0
      } else {
        skuSalesMap.set(skuId, {
          sku_code: skuInfo?.sku_code || 'Unknown',
          name: skuInfo?.name || 'Unknown',
          quantity: item.quantity || 0,
        })
      }
    }

    // Convert to sorted array (top 10)
    const skuSalesData: SkuSalesData[] = Array.from(skuSalesMap.entries())
      .map(([sku_id, data]) => ({
        sku_id,
        sku_code: data.sku_code,
        name: data.name,
        quantity_sold: data.quantity,
      }))
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .slice(0, 10)

    const totalSkusSold = skuSalesMap.size
    const totalQuantitySold = Array.from(skuSalesMap.values()).reduce((sum, s) => sum + s.quantity, 0)

    // ===========================================
    // 5. SUMMARY STATS
    // ===========================================
    const currentMonthData = monthlyData[monthlyData.length - 1]
    const previousMonthData = monthlyData[monthlyData.length - 2]

    const costTrend = previousMonthData && previousMonthData.cost > 0
      ? Math.round(((currentMonthData.cost - previousMonthData.cost) / previousMonthData.cost) * 100)
      : 0

    const shipmentsTrend = previousMonthData && previousMonthData.shipments > 0
      ? Math.round(((currentMonthData.shipments - previousMonthData.shipments) / previousMonthData.shipments) * 100)
      : 0

    const criticalStockCount = stockForecast.filter(s =>
      s.days_remaining !== null && s.days_remaining < 30
    ).length

    return NextResponse.json({
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
        data: stockForecast.slice(0, 20), // Top 20 most urgent
        criticalCount: criticalStockCount,
        totalTracked: stockForecast.length,
      },
      skuSales: {
        data: skuSalesData,
        totalSkus: totalSkusSold,
        totalQuantity: totalQuantitySold,
      },
      generatedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600', // 5 min cache
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
