import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getServerDb } from '@/lib/supabase/untyped'
import { getFastUser, getFastTenantId } from '@/lib/supabase/fast-auth'

export const revalidate = 60

interface DashboardMetricRow {
  metric: 'month' | 'all_time_missing' | 'yesterday' | 'day'
  day: string | null
  shipments_count: number | string
  shipments_cost: number | string
  shipments_missing_pricing: number | string
}

interface SkuMetricRow {
  sku_id: string
  sku_code: string
  name: string
  qty_current: number
  consumption_30d: number
  consumption_90d: number
  avg_daily_90d: number
  days_remaining: number | null
  is_bundle: boolean
}

function toInt(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  try {
    const user = await getFastUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const tenantId = (await getFastTenantId()) || user.tenant_id
    const adminDb = getAdminDb()
    const serverDb = await getServerDb()

    const searchParams = request.nextUrl.searchParams
    const monthParam = searchParams.get('month')
    const now = new Date()

    let targetYear: number
    let targetMonth: number
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number)
      targetYear = y
      targetMonth = m - 1
    } else {
      targetYear = now.getFullYear()
      targetMonth = now.getMonth()
    }

    const currentMonth = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`
    const startOfMonth = new Date(targetYear, targetMonth, 1)
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999)
    const isCurrentMonth =
      targetYear === now.getFullYear() && targetMonth === now.getMonth()
    const daysInMonth = isCurrentMonth
      ? now.getDate()
      : new Date(targetYear, targetMonth + 1, 0).getDate()

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(yesterday)
    yesterdayEnd.setHours(23, 59, 59, 999)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const monthStartStr = startOfMonth.toISOString().split('T')[0]
    const monthEndStr = endOfMonth.toISOString().split('T')[0]

    // 4 queries in parallel — dashboard_metrics RPC does the heavy lifting
    // (monthly totals + all-time missing + yesterday + daily chart in one call).
    // mv_sku_metrics has is_bundle flag so we don't need a separate bundles query.
    const [metricsResult, indemnityResult, claimsYesterdayResult, stockResult, syncRunResult] =
      await Promise.all([
        adminDb.rpc('get_dashboard_metrics', {
          p_tenant_id: tenantId,
          p_month_start: monthStartStr,
          p_month_end: monthEndStr,
          p_yesterday: yesterdayStr,
        }),
        serverDb.rpc('get_monthly_indemnities', {
          p_tenant_id: tenantId,
          p_start_date: startOfMonth.toISOString(),
          p_end_date: endOfMonth.toISOString(),
        }),
        serverDb
          .from('claims')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('opened_at', yesterday.toISOString())
          .lte('opened_at', yesterdayEnd.toISOString()),
        // mv_sku_metrics is a materialized view (no RLS) — use admin client + explicit tenant filter
        adminDb
          .from('mv_sku_metrics')
          .select(
            'sku_id, sku_code, name, qty_current, consumption_30d, consumption_90d, avg_daily_90d, days_remaining, is_bundle'
          )
          .eq('tenant_id', tenantId)
          .eq('is_bundle', false),
        // Dernier sync Sendcloud réel du tenant — pilote le point de fraîcheur du dashboard
        // (sync_runs est sous RLS : on utilise adminDb + filtre tenant explicite, comme le hub)
        adminDb
          .from('sync_runs')
          .select('ended_at, status')
          .eq('tenant_id', tenantId)
          .eq('source', 'sendcloud')
          .in('status', ['success', 'partial', 'failed'])
          .order('ended_at', { ascending: false })
          .limit(1),
      ])

    const metricRows = (metricsResult.data || []) as DashboardMetricRow[]

    // Parse metric rows by category
    let shipmentsCount = 0
    let totalCost = 0
    let missingPricingMonthCount = 0
    let missingPricingTotalCount = 0
    let shipmentsYesterday = 0
    let costYesterday = 0
    const dailyByDay = new Map<string, { shipments: number; cost: number }>()

    for (const row of metricRows) {
      switch (row.metric) {
        case 'month':
          shipmentsCount = toInt(row.shipments_count)
          totalCost = Number(row.shipments_cost) || 0
          missingPricingMonthCount = toInt(row.shipments_missing_pricing)
          break
        case 'all_time_missing':
          missingPricingTotalCount = toInt(row.shipments_missing_pricing)
          break
        case 'yesterday':
          shipmentsYesterday = toInt(row.shipments_count)
          costYesterday = Number(row.shipments_cost) || 0
          break
        case 'day':
          if (row.day) {
            dailyByDay.set(row.day, {
              shipments: toInt(row.shipments_count),
              cost: Number(row.shipments_cost) || 0,
            })
          }
          break
      }
    }
    void shipmentsYesterday // reserved for future KPI

    // Build full daily chart (fill gaps with zeros)
    const chartData = []
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const dayData = dailyByDay.get(dateStr) || { shipments: 0, cost: 0 }
      chartData.push({
        date: new Date(targetYear, targetMonth, i).toISOString(),
        shipments: dayData.shipments,
        cost: dayData.cost,
      })
    }

    const indemnityData = indemnityResult.data as
      | { indemnity_eur: number | null }[]
      | null
    const totalIndemnity =
      indemnityData?.reduce(
        (sum, c) => sum + (Number(c.indemnity_eur) || 0),
        0
      ) ?? 0

    const claimsYesterdayCount = claimsYesterdayResult.count || 0

    // Stock health from mv_sku_metrics (bundles already filtered out via is_bundle flag)
    const skuMetrics = (stockResult.data || []) as SkuMetricRow[]

    const stockHealth = skuMetrics
      .filter((m) => {
        if (m.sku_code.toUpperCase().includes('BU-')) return false
        return (
          m.qty_current < 50 ||
          (m.days_remaining !== null && m.days_remaining < 30)
        )
      })
      .map((m) => ({
        sku: m.sku_code,
        stock: m.qty_current,
        avgConsumption90d: m.avg_daily_90d,
        consumption30d: m.consumption_30d,
        daysRemaining:
          m.days_remaining !== null ? Math.max(1, m.days_remaining) : 999,
        isBundle: false,
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 10)

    const criticalStockCount = skuMetrics.filter((m) => {
      if (m.sku_code.toUpperCase().includes('BU-')) return false
      return m.qty_current < 20
    }).length

    const missingPricingStatus =
      missingPricingMonthCount > 0 ? 'warning' : 'success'
    const indemnityStatus = totalIndemnity > 0 ? 'success' : 'default'
    const criticalStockStatus = criticalStockCount > 0 ? 'danger' : 'success'

    // Fraîcheur de sync réelle (était codée en dur sur 'ok'). Reflète le dernier
    // sync_run Sendcloud du tenant : un cron mort ou des syncs en échec deviennent
    // visibles côté client (point orange/rouge dans DashboardHeader).
    const lastSyncRow = (syncRunResult.data as
      | { ended_at: string | null; status: string }[]
      | null)?.[0]
    let lastSync: { date: string | null; status: 'ok' | 'warning' | 'failed' }
    if (!lastSyncRow || !lastSyncRow.ended_at) {
      lastSync = { date: lastSyncRow?.ended_at ?? null, status: 'failed' }
    } else {
      const ageMs = Date.now() - new Date(lastSyncRow.ended_at).getTime()
      let syncStatus: 'ok' | 'warning' | 'failed'
      if (lastSyncRow.status === 'failed' || ageMs > 6 * 60 * 60 * 1000) {
        syncStatus = 'failed'
      } else if (lastSyncRow.status === 'partial' || ageMs > 60 * 60 * 1000) {
        syncStatus = 'warning'
      } else {
        syncStatus = 'ok'
      }
      lastSync = { date: lastSyncRow.ended_at, status: syncStatus }
    }

    return NextResponse.json(
      {
        currentMonth,
        kpis: {
          shipments: {
            label: 'Expéditions',
            value: shipmentsCount,
            subValue: 'ce mois-ci',
            status: 'default',
          },
          cost: {
            label: 'Coût transport',
            value: `${totalCost.toFixed(2)} €`,
            subValue: 'ce mois-ci',
            status: 'default',
          },
          missingPricing: {
            label: 'Tarifs manquants',
            value: missingPricingMonthCount,
            subValue: 'ce mois-ci',
            status: missingPricingStatus,
          },
          indemnity: {
            label: 'Total indemnisé',
            value: `${totalIndemnity.toFixed(2)} €`,
            subValue: 'ce mois-ci',
            status: indemnityStatus,
          },
          criticalStock: {
            label: 'SKUs critiques',
            value: criticalStockCount,
            subValue: 'stock < 20',
            status: criticalStockStatus,
          },
          claimsYesterday: {
            label: 'Réclamations',
            value: claimsYesterdayCount,
            subValue: 'hier',
            status: claimsYesterdayCount > 0 ? 'warning' : 'success',
          },
          costYesterday: {
            label: 'Coût HME hier',
            value: `${costYesterday.toFixed(2)} €`,
            subValue: 'hier',
            status: 'default',
          },
        },
        chartData,
        stockHealth,
        alerts: [
          ...(criticalStockCount > 0
            ? [
                {
                  id: 'stock-critique',
                  type: 'stock_critique',
                  title: 'Stock critique',
                  description: `${criticalStockCount} SKU(s) faibles`,
                  count: criticalStockCount,
                  actionLabel: 'Gérer',
                  actionLink: '/produits?filter=critique',
                },
              ]
            : []),
          ...(missingPricingTotalCount > 0
            ? [
                {
                  id: 'tarif-manquant',
                  type: 'tarif_manquant',
                  title: 'Tarifs manquants',
                  description: `${missingPricingTotalCount} total (${missingPricingMonthCount} ce mois)`,
                  count: missingPricingTotalCount,
                  actionLabel: 'Corriger',
                  actionLink: '/expeditions?pricing_status=missing',
                },
              ]
            : []),
        ],
        billing: {
          status: 'pending',
          totalCost,
          missingPricingCount: missingPricingMonthCount,
          missingPricingTotal: missingPricingTotalCount,
          totalIndemnity,
        },
        lastSync,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
