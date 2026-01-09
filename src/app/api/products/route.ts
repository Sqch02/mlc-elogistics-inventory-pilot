import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFastUser } from '@/lib/supabase/fast-auth'
import { calculateSKUMetrics, getCriticalStockThreshold } from '@/lib/utils/stock'

export async function GET(request: NextRequest) {
  try {
    const user = await getFastUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const tenantId = user.tenant_id
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    // Get full SKU data including description and alert_threshold
    let query = supabase
      .from('skus')
      .select(`
        id,
        sku_code,
        name,
        description,
        alert_threshold
      `)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sku_code')

    if (search) {
      query = query.or(`sku_code.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data: skusData, error } = await query

    if (error) {
      throw error
    }

    // Get full metrics from calculateSKUMetrics
    const metrics = await calculateSKUMetrics(tenantId)
    const metricsMap = new Map(metrics.map(m => [m.sku_id, m]))

    const criticalThreshold = getCriticalStockThreshold()

    interface SKURow {
      id: string
      sku_code: string
      name: string
      description: string | null
      alert_threshold: number
    }

    // Transform data with full metrics
    const skus = (skusData || []).map((sku: SKURow) => {
      const m = metricsMap.get(sku.id)
      const qtyCurrent = m?.qty_current || 0
      const alertThreshold = sku.alert_threshold || 10
      const daysRemaining = m?.days_remaining ?? null

      // Calculate status based on days remaining and stock level
      let skuStatus: 'ok' | 'warning' | 'critical' | 'rupture' = 'ok'
      if (qtyCurrent === 0) {
        skuStatus = 'rupture'
      } else if (daysRemaining !== null && daysRemaining < criticalThreshold) {
        skuStatus = 'critical'
      } else if (qtyCurrent < alertThreshold) {
        skuStatus = 'critical'
      } else if (daysRemaining !== null && daysRemaining < criticalThreshold * 2) {
        skuStatus = 'warning'
      } else if (qtyCurrent < alertThreshold * 2) {
        skuStatus = 'warning'
      }

      return {
        id: sku.id,
        sku_code: sku.sku_code,
        name: sku.name,
        description: sku.description,
        alert_threshold: alertThreshold,
        qty_current: qtyCurrent,
        consumption_30d: m?.consumption_30d || 0,
        consumption_90d: m?.consumption_90d || 0,
        avg_daily_90d: m?.avg_daily_90d || 0,
        days_remaining: daysRemaining,
        pending_restock: m?.pending_restock || 0,
        projected_stock: m?.projected_stock || qtyCurrent,
        status: skuStatus,
      }
    })

    interface TransformedSKU {
      id: string
      sku_code: string
      name: string
      description: string | null
      alert_threshold: number
      qty_current: number
      consumption_30d: number
      consumption_90d: number
      avg_daily_90d: number
      days_remaining: number | null
      pending_restock: number
      projected_stock: number
      status: 'ok' | 'warning' | 'critical' | 'rupture'
    }

    // Filter by status if requested
    const filteredSkus = status
      ? skus.filter((s: TransformedSKU) => s.status === status)
      : skus

    return NextResponse.json({
      skus: filteredSkus,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Products error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
