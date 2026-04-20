import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { getFastUser, getFastTenantId } from '@/lib/supabase/fast-auth'
import { getCriticalStockThreshold } from '@/lib/utils/stock'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'

interface SkuMetricRow {
  sku_id: string
  sku_code: string
  name: string
  alert_threshold: number | null
  qty_current: number
  consumption_30d: number
  consumption_90d: number
  avg_daily_90d: number
  days_remaining: number | null
  pending_restock: number
  projected_stock: number
  is_bundle: boolean
}

interface SkuBaseRow {
  id: string
  volume_m3: number | null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getFastUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const tenantId = (await getFastTenantId()) || user.tenant_id
    // mv_sku_metrics is a materialized view (no RLS) — use admin client with explicit tenant filter
    const supabase = getAdminDb()

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    // Fetch from mat view (pre-aggregated) + extra columns (volume_m3) from skus
    const [metricsRes, skuExtraRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('mv_sku_metrics')
          .select(
            'sku_id, sku_code, name, alert_threshold, qty_current, consumption_30d, consumption_90d, avg_daily_90d, days_remaining, pending_restock, projected_stock, is_bundle'
          )
          .eq('tenant_id', tenantId)
          .eq('is_bundle', false)
          .order('sku_code')

        if (search) {
          const s = sanitizeSearchInput(search)
          if (s) q = q.or(`sku_code.ilike.%${s}%,name.ilike.%${s}%`)
        }
        return q
      })(),
      supabase
        .from('skus')
        .select('id, volume_m3')
        .eq('tenant_id', tenantId)
        .eq('active', true),
    ])

    if (metricsRes.error) throw metricsRes.error

    const metrics = (metricsRes.data || []) as SkuMetricRow[]
    const extras = (skuExtraRes.data || []) as SkuBaseRow[]
    const volumeMap = new Map(extras.map((e) => [e.id, e.volume_m3]))

    const criticalThreshold = getCriticalStockThreshold()

    const skus = metrics
      // filter out "BU-" coded SKUs (same legacy rule as before)
      .filter((m) => !m.sku_code.toUpperCase().includes('BU-'))
      .map((m) => {
        const qtyCurrent = m.qty_current || 0
        const alertThreshold = m.alert_threshold || 10
        const daysRemaining = m.days_remaining

        let skuStatus: 'ok' | 'warning' | 'critical' | 'rupture' = 'ok'
        if (qtyCurrent === 0) {
          skuStatus = 'rupture'
        } else if (daysRemaining !== null && daysRemaining < criticalThreshold) {
          skuStatus = 'critical'
        } else if (qtyCurrent < alertThreshold) {
          skuStatus = 'critical'
        } else if (
          daysRemaining !== null &&
          daysRemaining < criticalThreshold * 2
        ) {
          skuStatus = 'warning'
        } else if (qtyCurrent < alertThreshold * 2) {
          skuStatus = 'warning'
        }

        return {
          id: m.sku_id,
          sku_code: m.sku_code,
          name: m.name,
          volume_m3: volumeMap.get(m.sku_id) ?? null,
          alert_threshold: alertThreshold,
          qty_current: qtyCurrent,
          consumption_30d: m.consumption_30d || 0,
          consumption_90d: m.consumption_90d || 0,
          avg_daily_90d: m.avg_daily_90d || 0,
          days_remaining: daysRemaining,
          pending_restock: m.pending_restock || 0,
          projected_stock: m.projected_stock || qtyCurrent,
          status: skuStatus,
        }
      })

    const filteredSkus = status ? skus.filter((s) => s.status === status) : skus

    return NextResponse.json(
      { skus: filteredSkus },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    console.error('Products error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
