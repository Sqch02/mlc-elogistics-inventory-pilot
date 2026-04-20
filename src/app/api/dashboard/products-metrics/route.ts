import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

interface PhysicalItem {
  sku_id: string
  physical_qty: number | null
  shipped_at: string | null
}

interface BundleLineItem {
  sku_id: string
  qty: number | null
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
    const supabase = getAdminDb()

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

    // Get all bundle SKU IDs (for filtering bundle line-item volumes)
    const { data: bundles } = await supabase
      .from('bundles')
      .select('bundle_sku_id')
      .eq('tenant_id', tenantId)

    const bundleSkuIds = new Set((bundles || []).map((b: BundleRow) => b.bundle_sku_id))

    // Get all SKUs for name resolution
    const { data: allSkus } = await supabase.from('skus').select('id, sku_code, name').eq('tenant_id', tenantId)
    const skuLookup = new Map<string, { sku_code: string; name: string }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(allSkus as any[] || []).forEach((s: any) => { skuLookup.set(s.id, { sku_code: s.sku_code, name: s.name }) })

    // Query the physical shipment items view (bundles already decomposed by the DB).
    // Returns one row per (shipment, sku) with physical_qty = real physical units.
    const pageSize = 1000
    const physicalItems: PhysicalItem[] = []
    {
      let page = 0
      let hasMore = true
      while (hasMore) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: itemsPage, error } = await (supabase as any)
          .from('v_physical_shipment_items')
          .select('sku_id, physical_qty, shipped_at')
          .eq('tenant_id', tenantId)
          .gte('shipped_at', fromDate.toISOString())
          .lte('shipped_at', toDate.toISOString())
          .eq('is_return', false)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error

        if (itemsPage && itemsPage.length > 0) {
          physicalItems.push(...(itemsPage as PhysicalItem[]))
          hasMore = itemsPage.length === pageSize
          page++
        } else {
          hasMore = false
        }
      }
    }

    // Also query raw shipment_items for bundle SKUs only, to compute bundle-level
    // volumes (as Shopify line items, not decomposed). The view groups by component
    // sku so it can't tell us "how many bundles were sold as bundles".
    const bundleLineItems: BundleLineItem[] = []
    if (bundleSkuIds.size > 0) {
      let page = 0
      let hasMore = true
      while (hasMore) {
        const { data: itemsPage, error } = await supabase
          .from('shipment_items')
          .select('sku_id, qty, shipments!inner(shipped_at)')
          .eq('tenant_id', tenantId)
          .in('sku_id', Array.from(bundleSkuIds))
          .gte('shipments.shipped_at', fromDate.toISOString())
          .lte('shipments.shipped_at', toDate.toISOString())
          .eq('shipments.is_return', false)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error

        if (itemsPage && itemsPage.length > 0) {
          bundleLineItems.push(...(itemsPage as unknown as BundleLineItem[]))
          hasMore = itemsPage.length === pageSize
          page++
        } else {
          hasMore = false
        }
      }
    }

    // Aggregate physical volumes by sku (bundles already decomposed by the view)
    const physicalVolumes = new Map<string, {
      sku_id: string
      sku_code: string
      name: string
      volume: number
    }>()

    for (const item of physicalItems) {
      if (!item.sku_id) continue
      const qty = item.physical_qty || 0
      const existing = physicalVolumes.get(item.sku_id)
      if (existing) {
        existing.volume += qty
      } else {
        const skuInfo = skuLookup.get(item.sku_id)
        physicalVolumes.set(item.sku_id, {
          sku_id: item.sku_id,
          sku_code: skuInfo?.sku_code || '',
          name: skuInfo?.name || '',
          volume: qty,
        })
      }
    }

    // Aggregate bundle-level volumes (Shopify line items for bundle SKUs)
    const bundleVolumes = new Map<string, {
      sku_id: string
      sku_code: string
      name: string
      volume: number
    }>()

    for (const item of bundleLineItems) {
      if (!item.sku_id) continue
      const qty = item.qty || 0
      const existing = bundleVolumes.get(item.sku_id)
      if (existing) {
        existing.volume += qty
      } else {
        const skuInfo = skuLookup.get(item.sku_id)
        bundleVolumes.set(item.sku_id, {
          sku_id: item.sku_id,
          sku_code: skuInfo?.sku_code || '',
          name: skuInfo?.name || '',
          volume: qty,
        })
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

    // Build monthly breakdown.
    // - products = sum of physical_qty (bundles already decomposed)
    // - bundles = sum of bundle-line-item qty (not decomposed)
    const monthlyMap = new Map<string, { products: number; bundles: number }>()
    for (const item of physicalItems) {
      if (!item.shipped_at) continue
      const d = new Date(item.shipped_at)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyMap.get(monthKey) || { products: 0, bundles: 0 }
      existing.products += item.physical_qty || 0
      monthlyMap.set(monthKey, existing)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of bundleLineItems as any[]) {
      const shippedAt = item.shipments?.shipped_at
      if (!shippedAt) continue
      const d = new Date(shippedAt)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyMap.get(monthKey) || { products: 0, bundles: 0 }
      existing.bundles += item.qty || 0
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
