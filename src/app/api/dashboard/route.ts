import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFastUser } from '@/lib/supabase/fast-auth'
import { calculateSKUMetrics } from '@/lib/utils/stock'

export const revalidate = 60 // Cache for 60 seconds

export async function GET(request: NextRequest) {
  try {
    const user = await getFastUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const tenantId = user.tenant_id
    const supabase = await createClient()

    // Get month from query param or default to current month
    const searchParams = request.nextUrl.searchParams
    const monthParam = searchParams.get('month') // Format: YYYY-MM

    const now = new Date()
    let targetYear: number
    let targetMonth: number

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split('-').map(Number)
      targetYear = year
      targetMonth = month - 1 // JS months are 0-indexed
    } else {
      targetYear = now.getFullYear()
      targetMonth = now.getMonth()
    }

    const currentMonth = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`
    const startOfMonth = new Date(targetYear, targetMonth, 1)
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59)

    // For chart, determine how many days to show
    const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === now.getMonth()
    const daysInMonth = isCurrentMonth ? now.getDate() : new Date(targetYear, targetMonth + 1, 0).getDate()

    // Run all queries in parallel
    const [
      shipmentsResult,
      shipmentsCostResult,
      missingPricingMonthResult,
      missingPricingTotalResult,
      claimsResult,
      stockResult,
      dailyShipmentsResult
    ] = await Promise.all([
      supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('shipped_at', startOfMonth.toISOString())
        .lte('shipped_at', endOfMonth.toISOString()),

      supabase
        .from('shipments')
        .select('computed_cost_eur')
        .eq('tenant_id', tenantId)
        .eq('pricing_status', 'ok')
        .gte('shipped_at', startOfMonth.toISOString())
        .lte('shipped_at', endOfMonth.toISOString()),

      supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('pricing_status', 'missing')
        .gte('shipped_at', startOfMonth.toISOString())
        .lte('shipped_at', endOfMonth.toISOString()),

      supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('pricing_status', 'missing'),

      supabase
        .from('claims')
        .select('indemnity_eur')
        .eq('tenant_id', tenantId)
        .eq('status', 'indemnisee')
        .gte('decided_at', startOfMonth.toISOString())
        .lte('decided_at', endOfMonth.toISOString()),

      supabase
        .from('stock_snapshots')
        .select('qty_current, skus(sku_code, name)')
        .eq('tenant_id', tenantId)
        .lt('qty_current', 50)
        .order('qty_current')
        .limit(10),

      supabase
        .from('shipments')
        .select('shipped_at, computed_cost_eur')
        .eq('tenant_id', tenantId)
        .gte('shipped_at', startOfMonth.toISOString())
        .lte('shipped_at', endOfMonth.toISOString())
        .order('shipped_at')
    ])

    const shipmentsCost = shipmentsCostResult.data as { computed_cost_eur: number | null }[] | null
    const totalCost = shipmentsCost?.reduce((sum, s) => sum + (Number(s.computed_cost_eur) || 0), 0) || 0

    const claimsData = claimsResult.data as { indemnity_eur: number | null }[] | null
    const totalIndemnity = claimsData?.reduce((sum, c) => sum + (Number(c.indemnity_eur) || 0), 0) || 0

    const shipmentsCount = shipmentsResult.count || 0
    const missingPricingMonthCount = missingPricingMonthResult.count || 0
    const missingPricingTotalCount = missingPricingTotalResult.count || 0
    const criticalStockCount = stockResult.data?.filter((s: { qty_current: number }) => s.qty_current < 20).length || 0

    // Group daily shipments
    const dailyShipments = dailyShipmentsResult.data as { shipped_at: string; computed_cost_eur: number | null }[] | null
    const shipmentsByDay = new Map<string, { shipments: number; cost: number }>()
    for (const s of dailyShipments || []) {
      const day = s.shipped_at.split('T')[0]
      const existing = shipmentsByDay.get(day) || { shipments: 0, cost: 0 }
      shipmentsByDay.set(day, {
        shipments: existing.shipments + 1,
        cost: existing.cost + (Number(s.computed_cost_eur) || 0)
      })
    }

    const chartData = []
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const dayData = shipmentsByDay.get(dateStr) || { shipments: 0, cost: 0 }
      chartData.push({
        date: new Date(targetYear, targetMonth, i).toISOString(),
        shipments: dayData.shipments,
        cost: dayData.cost
      })
    }

    // Get real consumption metrics for stock health
    const skuMetrics = await calculateSKUMetrics(tenantId)

    // Filter to critical stock (low qty or low days remaining) and sort by criticality
    const stockHealth = skuMetrics
      .filter(m => m.qty_current < 50 || (m.days_remaining !== null && m.days_remaining < 30))
      .map(m => ({
        sku: m.sku_code,
        stock: m.qty_current,
        avgConsumption90d: m.avg_daily_90d,
        consumption30d: m.consumption_30d,
        daysRemaining: m.days_remaining !== null ? Math.max(1, m.days_remaining) : 999,
        isBundle: false
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 10)

    const missingPricingStatus = missingPricingMonthCount > 0 ? 'warning' : 'success'
    const indemnityStatus = totalIndemnity > 0 ? 'success' : 'default'
    const criticalStockStatus = criticalStockCount > 0 ? 'danger' : 'success'

    return NextResponse.json({
      currentMonth,
      kpis: {
        shipments: { label: "Expéditions", value: shipmentsCount, subValue: "ce mois-ci", status: 'default' },
        cost: { label: "Coût transport", value: `${totalCost.toFixed(2)} €`, subValue: "ce mois-ci", status: 'default' },
        missingPricing: { label: "Tarifs manquants", value: missingPricingMonthCount, subValue: "ce mois-ci", status: missingPricingStatus },
        indemnity: { label: "Total indemnisé", value: `${totalIndemnity.toFixed(2)} €`, subValue: "ce mois-ci", status: indemnityStatus },
        criticalStock: { label: "SKUs critiques", value: criticalStockCount, subValue: "stock < 20", status: criticalStockStatus },
        shipmentsWithoutItems: { label: "Sans items", value: 0, status: 'success' },
      },
      chartData,
      stockHealth,
      alerts: [
        ...(criticalStockCount > 0 ? [{ id: 'stock-critique', type: 'stock_critique', title: 'Stock critique', description: `${criticalStockCount} SKU(s) faibles`, count: criticalStockCount, actionLabel: 'Gérer', actionLink: '/produits?filter=critique' }] : []),
        ...(missingPricingTotalCount > 0 ? [{ id: 'tarif-manquant', type: 'tarif_manquant', title: 'Tarifs manquants', description: `${missingPricingTotalCount} total (${missingPricingMonthCount} ce mois)`, count: missingPricingTotalCount, actionLabel: 'Corriger', actionLink: '/expeditions?pricing_status=missing' }] : [])
      ],
      billing: { status: 'pending', totalCost, missingPricingCount: missingPricingMonthCount, missingPricingTotal: missingPricingTotalCount, totalIndemnity },
      lastSync: { date: new Date().toISOString(), status: 'ok' }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
