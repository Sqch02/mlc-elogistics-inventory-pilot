import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

interface RawProduct {
  sku_id: string
  sku_code: string
  name: string
  volume: number | string
}

interface RawMonthly {
  month: string
  products: number | string
  bundles: number | string
}

interface RawSummary {
  totalProducts: number
  totalBundles: number
  totalProductsVolume: number | string
  totalBundlesVolume: number | string
}

interface RpcResponse {
  topProducts: RawProduct[]
  topBundles: RawProduct[]
  monthlyVolumes: RawMonthly[]
  summary: RawSummary
}

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = getAdminDb()

    const searchParams = request.nextUrl.searchParams
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 10

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

    // Single RPC call does all aggregation server-side (replaces 180+ pagination roundtrips).
    const { data, error } = await supabase.rpc('get_products_metrics', {
      p_tenant_id: tenantId,
      p_start_date: fromDate.toISOString(),
      p_end_date: toDate.toISOString(),
      p_limit: limit,
    })

    if (error) throw error

    const rpc = (data || {
      topProducts: [],
      topBundles: [],
      monthlyVolumes: [],
      summary: {
        totalProducts: 0,
        totalBundles: 0,
        totalProductsVolume: 0,
        totalBundlesVolume: 0,
      },
    }) as RpcResponse

    const totalProductsVolume = toNum(rpc.summary.totalProductsVolume)
    const totalBundlesVolume = toNum(rpc.summary.totalBundlesVolume)

    const topProducts = rpc.topProducts.map((p, i) => {
      const volume = toNum(p.volume)
      return {
        rank: i + 1,
        sku_id: p.sku_id,
        sku_code: p.sku_code,
        name: p.name,
        volume,
        percentage:
          totalProductsVolume > 0
            ? Math.round((volume / totalProductsVolume) * 10000) / 100
            : 0,
      }
    })

    const topBundles = rpc.topBundles.map((b, i) => {
      const volume = toNum(b.volume)
      return {
        rank: i + 1,
        sku_id: b.sku_id,
        sku_code: b.sku_code,
        name: b.name,
        volume,
        percentage:
          totalBundlesVolume > 0
            ? Math.round((volume / totalBundlesVolume) * 10000) / 100
            : 0,
      }
    })

    // Fill in all months in range (including empty ones) for stable chart
    const monthlyMap = new Map<string, { products: number; bundles: number }>()
    for (const row of rpc.monthlyVolumes) {
      monthlyMap.set(row.month, {
        products: toNum(row.products),
        bundles: toNum(row.bundles),
      })
    }

    const monthlyVolumes: Array<{
      month: string
      label: string
      products: number
      bundles: number
      total: number
    }> = []
    const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
    while (cursor <= toDate) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      const label = cursor
        .toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        .toUpperCase()
      const m = monthlyMap.get(key) || { products: 0, bundles: 0 }
      monthlyVolumes.push({
        month: key,
        label,
        products: m.products,
        bundles: m.bundles,
        total: m.products + m.bundles,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    const totalVolume = totalProductsVolume + totalBundlesVolume
    const bundlePercentage =
      totalVolume > 0
        ? Math.round((totalBundlesVolume / totalVolume) * 10000) / 100
        : 0

    return NextResponse.json(
      {
        period: {
          from: fromDate.toISOString().split('T')[0],
          to: toDate.toISOString().split('T')[0],
        },
        topProducts,
        topBundles: topBundles.map((b) => ({ ...b, isBundle: true })),
        summary: {
          totalProducts: rpc.summary.totalProducts,
          totalBundles: rpc.summary.totalBundles,
          totalProductsVolume,
          totalBundlesVolume,
          totalVolume,
          bundlePercentage,
        },
        monthlyVolumes,
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('Products metrics error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
