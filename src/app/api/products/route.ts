import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFastUser, getFastTenantId } from '@/lib/supabase/fast-auth'
import { calculateSKUMetrics, getCriticalStockThreshold } from '@/lib/utils/stock'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'

export async function GET(request: NextRequest) {
  try {
    const user = await getFastUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const tenantId = await getFastTenantId() || user.tenant_id
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    // Get full SKU data including alert_threshold
    let query = supabase
      .from('skus')
      .select(`
        id,
        sku_code,
        name,
        alert_threshold
      `)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sku_code')

    if (search) {
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = sanitizeSearchInput(search)
      if (sanitizedSearch) {
        query = query.or(`sku_code.ilike.%${sanitizedSearch}%,name.ilike.%${sanitizedSearch}%`)
      }
    }

    const { data: skusData, error } = await query

    if (error) {
      throw error
    }

    // Get bundle SKU IDs to exclude them from products list
    const { data: bundles } = await supabase
      .from('bundles')
      .select('bundle_sku_id')
      .eq('tenant_id', tenantId)

    const bundleSkuIds = new Set((bundles || []).map((b: { bundle_sku_id: string }) => b.bundle_sku_id))

    // Filter out bundle SKUs
    const filteredSkusData = (skusData || []).filter((sku: { id: string; sku_code: string }) => {
      if (bundleSkuIds.has(sku.id)) return false
      // Also filter by code pattern
      if (sku.sku_code.toUpperCase().includes('BU-')) return false
      return true
    })

    // Get full metrics from calculateSKUMetrics
    const metrics = await calculateSKUMetrics(tenantId)
    const metricsMap = new Map(metrics.map(m => [m.sku_id, m]))

    const criticalThreshold = getCriticalStockThreshold()

    interface SKURow {
      id: string
      sku_code: string
      name: string
      alert_threshold: number
    }

    // Transform data with full metrics
    const skus = filteredSkusData.map((sku: SKURow) => {
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
        'Cache-Control': 'private, no-store'
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
