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

    // Get all bundle SKU IDs
    const { data: bundles } = await supabase
      .from('bundles')
      .select('bundle_sku_id')
      .eq('tenant_id', tenantId)

    const bundleSkuIds = new Set((bundles || []).map((b: BundleRow) => b.bundle_sku_id))

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

    // Aggregate by SKU
    const skuVolumes = new Map<string, {
      sku_id: string
      sku_code: string
      name: string
      volume: number
      isBundle: boolean
    }>()

    for (const item of allItems) {
      if (!item.skus) continue

      const existing = skuVolumes.get(item.sku_id)
      const qty = item.qty || 0
      const isBundle = bundleSkuIds.has(item.sku_id) || item.skus.sku_code.toUpperCase().startsWith('BU-')

      if (existing) {
        existing.volume += qty
      } else {
        skuVolumes.set(item.sku_id, {
          sku_id: item.sku_id,
          sku_code: item.skus.sku_code,
          name: item.skus.name,
          volume: qty,
          isBundle,
        })
      }
    }

    // Separate products and bundles
    const products = Array.from(skuVolumes.values())
      .filter(s => !s.isBundle)
      .sort((a, b) => b.volume - a.volume)

    const bundlesSold = Array.from(skuVolumes.values())
      .filter(s => s.isBundle)
      .sort((a, b) => b.volume - a.volume)

    // Calculate totals
    const totalProductsVolume = products.reduce((sum, p) => sum + p.volume, 0)
    const totalBundlesVolume = bundlesSold.reduce((sum, b) => sum + b.volume, 0)

    // Build monthly breakdown from allItems (already in memory) — avoids N+1 queries
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
        existing.bundles += qty
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
