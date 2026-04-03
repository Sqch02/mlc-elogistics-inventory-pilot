import { getServerDb } from '@/lib/supabase/untyped'

export interface SKUStockMetrics {
  sku_id: string
  sku_code: string
  name: string
  qty_current: number
  consumption_30d: number
  consumption_90d: number
  avg_daily_90d: number
  days_remaining: number | null
  pending_restock: number
  projected_stock: number
}

interface BundleData {
  bundle_sku_id: string
  bundle_components: Array<{ component_sku_id: string; qty_component: number }>
}

interface SKUData {
  id: string
  sku_code: string
  name: string
  stock_snapshots: { qty_current: number } | Array<{ qty_current: number }>
}



interface RestockData {
  sku_id: string
  qty: number
}

export async function calculateSKUMetrics(
  tenantId: string,
  skuId?: string
): Promise<SKUStockMetrics[]> {
  const supabase = await getServerDb()

  const now = new Date()

  // Run all 4 queries in parallel
  let skuQuery = supabase
    .from('skus')
    .select(`
      id,
      sku_code,
      name,
      stock_snapshots(qty_current)
    `)
    .eq('tenant_id', tenantId)
    .eq('active', true)

  if (skuId) {
    skuQuery = skuQuery.eq('id', skuId)
  }

  const [skuResult, bundlesResult, shipmentItemsResult, restocksResult] = await Promise.all([
    skuQuery,
    supabase
      .from('bundles')
      .select(`
        bundle_sku_id,
        bundle_components(component_sku_id, qty_component)
      `)
      .eq('tenant_id', tenantId),
    supabase.rpc('get_sku_consumption_metrics', {
      p_tenant_id: tenantId,
    }),
    supabase
      .from('inbound_restock')
      .select('sku_id, qty')
      .eq('tenant_id', tenantId)
      .eq('received', false)
      .gte('eta_date', now.toISOString().split('T')[0]),
  ])

  const { data: skus, error: skuError } = skuResult

  if (skuError || !skus) {
    console.error('Error fetching SKUs:', skuError)
    return []
  }

  // Build bundle map for consumption decomposition
  const bundleMap = new Map<string, Array<{ component_sku_id: string; qty_component: number }>>()
  const bundlesList = bundlesResult.data as BundleData[] | null
  bundlesList?.forEach((bundle: BundleData) => {
    bundleMap.set(bundle.bundle_sku_id, bundle.bundle_components)
  })

  // Build consumption map from RPC results (pre-aggregated server-side)
  const consumptionMap = new Map<string, { last30d: number; last90d: number }>()
  const rpcData = shipmentItemsResult.data as Array<{ sku_id: string; total_qty_90d: number; total_qty_30d: number }> | null

  rpcData?.forEach((row) => {
    // Check if this SKU is a bundle - decompose into components
    const bundleComponents = bundleMap.get(row.sku_id)
    if (bundleComponents) {
      bundleComponents.forEach((comp) => {
        const current = consumptionMap.get(comp.component_sku_id) || { last30d: 0, last90d: 0 }
        current.last90d += (row.total_qty_90d || 0) * comp.qty_component
        current.last30d += (row.total_qty_30d || 0) * comp.qty_component
        consumptionMap.set(comp.component_sku_id, current)
      })
    } else {
      const current = consumptionMap.get(row.sku_id) || { last30d: 0, last90d: 0 }
      current.last90d += row.total_qty_90d || 0
      current.last30d += row.total_qty_30d || 0
      consumptionMap.set(row.sku_id, current)
    }
  })

  // Build restock map
  const restockMap = new Map<string, number>()
  const restocksList = restocksResult.data as RestockData[] | null
  restocksList?.forEach((r: RestockData) => {
    restockMap.set(r.sku_id, (restockMap.get(r.sku_id) || 0) + r.qty)
  })

  // Build metrics
  const skusList = skus as SKUData[]
  const metrics: SKUStockMetrics[] = skusList.map((sku: SKUData) => {
    const stockSnapshot = Array.isArray(sku.stock_snapshots)
      ? sku.stock_snapshots[0]
      : sku.stock_snapshots
    const qtyCurrent = stockSnapshot?.qty_current || 0
    const consumption = consumptionMap.get(sku.id) || { last30d: 0, last90d: 0 }
    const avgDaily90d = consumption.last90d / 90
    const daysRemaining = avgDaily90d > 0 ? Math.floor(qtyCurrent / avgDaily90d) : null
    const pendingRestock = restockMap.get(sku.id) || 0
    const projectedStock = qtyCurrent + pendingRestock

    return {
      sku_id: sku.id,
      sku_code: sku.sku_code,
      name: sku.name,
      qty_current: qtyCurrent,
      consumption_30d: consumption.last30d,
      consumption_90d: consumption.last90d,
      avg_daily_90d: Math.round(avgDaily90d * 100) / 100,
      days_remaining: daysRemaining,
      pending_restock: pendingRestock,
      projected_stock: projectedStock,
    }
  })

  return metrics
}

export function getCriticalStockThreshold(): number {
  return 7 // Days
}

export function isStockCritical(daysRemaining: number | null): boolean {
  if (daysRemaining === null) return false
  return daysRemaining < getCriticalStockThreshold()
}
