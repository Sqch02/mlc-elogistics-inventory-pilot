import { NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

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

interface SkuRow {
  id: string
  sku_code: string
  name: string
  alert_threshold: number | null
}

export async function GET() {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const now = new Date()

    // ===========================================
    // 1. COST TREND: Last 12 months
    // ===========================================
    const monthlyData: MonthlyData[] = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

      // Get shipments for this month
      const { data: shipments } = await supabase
        .from('shipments')
        .select('id, computed_cost_eur')
        .eq('tenant_id', tenantId)
        .eq('is_return', false)
        .gte('shipped_at', startOfMonth.toISOString())
        .lte('shipped_at', endOfMonth.toISOString())

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
    // Get all shipments from the last 90 days for carrier stats
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const { data: recentShipments } = await supabase
      .from('shipments')
      .select('id, carrier, computed_cost_eur')
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .gte('shipped_at', ninetyDaysAgo.toISOString())

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
    // 4. SUMMARY STATS
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
