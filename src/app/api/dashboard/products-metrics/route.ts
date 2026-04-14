import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

interface ShipmentItem {
  sku_id: string
  qty: number | null
  skus: {
    sku_code: string
    name: string
  } | null
}

interface BundleRow {
  bundle_sku_id: string
}

interface MonthlyVolume {
  month: string
  label: string
  products: number
  bundles: number
  total: number
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const searchParams = request.nextUrl.searchParams
    const fromParam = searchParams.get('from') // Format: YYYY-MM-DD
    const toParam = searchParams.get('to') // Format: YYYY-MM-DD
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 10

    // Default to last 12 months if no dates provided
    const now = new Date()
    let fromDate: Date
    let toDate: Date

    if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
      fromDate = new Date(fromParam)
    } else {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    }

    if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      toDate = new Date(toParam)
      toDate.setHours(23, 59, 59, 999)
    } else {
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    }

    // Get all bundles with components for decomposition
    const { data: bundles } = await supabase
      .from('bundles')
      .select('bundle_sku_id, bundle_components(component_sku_id, qty_component)')
      .eq('tenant_id', tenantId)

    const bundleSkuIds = new Set((bundles || []).map((b: BundleRow) => b.bundle_sku_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bundleComponentsMap = new Map<string, Array<{ component_sku_id: string; qty_component: number }>>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(bundles as any[] || []).forEach((b: any) => { bundleComponentsMap.set(b.bundle_sku_id, b.bundle_components || []) })

    // Get all SKUs for component name resolution
    const { data: allSkus } = await supabase.from('skus').select('id, sku_code, name').eq('tenant_id', tenantId)
    const skuLookup = new Map<string, { sku_code: string; name: string }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(allSkus as any[] || []).forEach((s: any) => { skuLookup.set(s.id, { sku_code: s.sku_code, name: s.name }) })

    // Get all shipment items in the date range with pagination
    const allItems: ShipmentItem[] = []
    const pageSize = 1000
    let page = 0
    let hasMore = true

    while (hasMore) {
      const { data: itemsPage, error } = await supabase
        .from('shipment_items')
        .select('sku_id, qty, skus(sku_code, name), shipments!inner(shipped_at)')
        .eq('tenant_id', tenantId)
        .gte('shipments.shipped_at', fromDate.toISOString())
        .lte('shipments.shipped_at', toDate.toISOString())
        .eq('shipments.is_return', false)
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) throw error

      if (itemsPage && itemsPage.length > 0) {
        allItems.push(...(itemsPage as unknown as ShipmentItem[]))
        hasMore = itemsPage.length === pageSize
        page++
      } else {
        hasMore = false
      }
    }

    // Aggregate by physical SKU (decompose bundles into components)
    const physicalVolumes = new Map<string, {
      sku_id: string
      sku_code: string
      name: string
      volume: number
    }>()
    // Also track bundle volumes separately (as Shopify line items, not decomposed)
    const bundleVolumes = new Map<string, {
      sku_id: string
      sku_code: string
      name: string
      volume: number
    }>()

    for (const item of allItems) {
      if (!item.skus) continue
      const qty = item.qty || 0
      const isBundle = bundleSkuIds.has(item.sku_id)

      if (isBundle) {
        // Track bundle as bundle
        const existingBundle = bundleVolumes.get(item.sku_id)
        if (existingBundle) { existingBundle.volume += qty }
        else { bundleVolumes.set(item.sku_id, { sku_id: item.sku_id, sku_code: item.skus.sku_code, name: item.skus.name, volume: qty }) }

        // Decompose into physical components
        const components = bundleComponentsMap.get(item.sku_id)
        if (components) {
          for (const comp of components) {
            const physicalQty = qty * comp.qty_component
            const existing = physicalVolumes.get(comp.component_sku_id)
            if (existing) { existing.volume += physicalQty }
            else {
              const skuInfo = skuLookup.get(comp.component_sku_id)
              physicalVolumes.set(comp.component_sku_id, { sku_id: comp.component_sku_id, sku_code: skuInfo?.sku_code || '', name: skuInfo?.name || '', volume: physicalQty })
            }
          }
        }
      } else {
        // Simple SKU = physical article
        const existing = physicalVolumes.get(item.sku_id)
        if (existing) { existing.volume += qty }
        else { physicalVolumes.set(item.sku_id, { sku_id: item.sku_id, sku_code: item.skus.sku_code, name: item.skus.name, volume: qty }) }
      }
    }

    // Products = physical articles (decomposed)
    const products = Array.from(physicalVolumes.values())
      .sort((a, b) => b.volume - a.volume)

    // Bundles = as Shopify line items (for reference)
    const bundlesSold = Array.from(bundleVolumes.values())
      .map(b => ({ ...b, isBundle: true }))
      .sort((a, b) => b.volume - a.volume)

    // Calculate totals (physical units)
    const totalProductsVolume = products.reduce((sum, p) => sum + p.volume, 0)
    const totalBundlesVolume = bundlesSold.reduce((sum, b) => sum + b.volume, 0)

    // Build monthly breakdown from allItems with bundle decomposition
    const monthlyMap = new Map<string, { products: number; bundles: number }>()
    for (const item of allItems) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shippedAt = (item as any).shipments?.shipped_at
      if (!shippedAt) continue
      const d = new Date(shippedAt)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyMap.get(monthKey) || { products: 0, bundles: 0 }
      const qty = item.qty || 0
      if (bundleSkuIds.has(item.sku_id)) {
        // Decompose bundle into physical units for the monthly count
        const components = bundleComponentsMap.get(item.sku_id)
        const physicalUnits = components ? components.reduce((sum, c) => sum + qty * c.qty_component, 0) : qty
        existing.products += physicalUnits
        existing.bundles += qty // Keep bundle count as orders (for reference)
      } else {
        existing.products += qty
      }
      monthlyMap.set(monthKey, existing)
    }

    // Fill in all months in the date range (including months with zero volume)
    const monthlyVolumes: MonthlyVolume[] = []
    const currentDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)

    while (currentDate <= toDate) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = currentDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).toUpperCase()
      const monthData = monthlyMap.get(monthKey) || { products: 0, bundles: 0 }

      monthlyVolumes.push({
        month: monthKey,
        label: monthLabel,
        products: monthData.products,
        bundles: monthData.bundles,
        total: monthData.products + monthData.bundles,
      })

      currentDate.setMonth(currentDate.getMonth() + 1)
    }

    return NextResponse.json({
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
      topProducts: products.slice(0, limit).map((p, i) => ({
        rank: i + 1,
        sku_id: p.sku_id,
        sku_code: p.sku_code,
        name: p.name,
        volume: p.volume,
        percentage: totalProductsVolume > 0 ? Math.round((p.volume / totalProductsVolume) * 10000) / 100 : 0,
      })),
      topBundles: bundlesSold.slice(0, limit).map((b, i) => ({
        rank: i + 1,
        sku_id: b.sku_id,
        sku_code: b.sku_code,
        name: b.name,
        volume: b.volume,
        percentage: totalBundlesVolume > 0 ? Math.round((b.volume / totalBundlesVolume) * 10000) / 100 : 0,
      })),
      summary: {
        totalProducts: products.length,
        totalBundles: bundlesSold.length,
        totalProductsVolume,
        totalBundlesVolume,
        totalVolume: totalProductsVolume + totalBundlesVolume,
        bundlePercentage: (totalProductsVolume + totalBundlesVolume) > 0
          ? Math.round((totalBundlesVolume / (totalProductsVolume + totalBundlesVolume)) * 10000) / 100
          : 0,
      },
      monthlyVolumes,
      generatedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Products metrics error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
