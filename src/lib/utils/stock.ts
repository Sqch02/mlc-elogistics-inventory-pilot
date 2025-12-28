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

interface ShipmentItemData {
  sku_id: string
  qty: number
  shipments: { shipped_at: string }
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
  const date30dAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const date90dAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Get SKUs with stock
  let skuQuery = supabase
    .from('skus')
    .select(`
      id,
      sku_code,
      name,
      stock_snapshots!inner(qty_current)
    `)
    .eq('tenant_id', tenantId)
    .eq('active', true)

  if (skuId) {
    skuQuery = skuQuery.eq('id', skuId)
  }

  const { data: skus, error: skuError } = await skuQuery

  if (skuError || !skus) {
    console.error('Error fetching SKUs:', skuError)
    return []
  }

  // Get bundles for consumption decomposition
  const { data: bundles } = await supabase
    .from('bundles')
    .select(`
      bundle_sku_id,
      bundle_components(component_sku_id, qty_component)
    `)
    .eq('tenant_id', tenantId)

  const bundleMap = new Map<string, Array<{ component_sku_id: string; qty_component: number }>>()
  const bundlesList = bundles as BundleData[] | null
  bundlesList?.forEach((bundle: BundleData) => {
    bundleMap.set(bundle.bundle_sku_id, bundle.bundle_components)
  })

  // Get shipment items for last 90 days
  const { data: shipmentItems } = await supabase
    .from('shipment_items')
    .select(`
      sku_id,
      qty,
      shipments!inner(shipped_at)
    `)
    .eq('tenant_id', tenantId)
    .gte('shipments.shipped_at', date90dAgo.toISOString())

  // Build consumption map
  const consumptionMap = new Map<string, { last30d: number; last90d: number }>()
  const itemsList = shipmentItems as ShipmentItemData[] | null

  itemsList?.forEach((item: ShipmentItemData) => {
    const shippedAt = new Date(item.shipments.shipped_at)
    const skuIds: Array<{ id: string; qty: number }> = []

    // Check if this is a bundle
    const bundleComponents = bundleMap.get(item.sku_id)
    if (bundleComponents) {
      // Decompose bundle into components
      bundleComponents.forEach((comp) => {
        skuIds.push({
          id: comp.component_sku_id,
          qty: item.qty * comp.qty_component,
        })
      })
    } else {
      skuIds.push({ id: item.sku_id, qty: item.qty })
    }

    // Add to consumption
    skuIds.forEach(({ id, qty }) => {
      const current = consumptionMap.get(id) || { last30d: 0, last90d: 0 }
      current.last90d += qty
      if (shippedAt >= date30dAgo) {
        current.last30d += qty
      }
      consumptionMap.set(id, current)
    })
  })

  // Get pending restocks
  const { data: restocks } = await supabase
    .from('inbound_restock')
    .select('sku_id, qty')
    .eq('tenant_id', tenantId)
    .eq('received', false)
    .gte('eta_date', now.toISOString().split('T')[0])

  const restockMap = new Map<string, number>()
  const restocksList = restocks as RestockData[] | null
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
