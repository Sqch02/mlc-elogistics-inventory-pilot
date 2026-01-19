'use client'

import { useQuery } from '@tanstack/react-query'

export interface ProductMetric {
  rank: number
  sku_id: string
  sku_code: string
  name: string
  volume: number
  percentage: number
}

export interface MonthlyVolume {
  month: string
  label: string
  products: number
  bundles: number
  total: number
}

export interface ProductsMetricsData {
  period: {
    from: string
    to: string
  }
  topProducts: ProductMetric[]
  topBundles: ProductMetric[]
  summary: {
    totalProducts: number
    totalBundles: number
    totalProductsVolume: number
    totalBundlesVolume: number
    totalVolume: number
    bundlePercentage: number
  }
  monthlyVolumes: MonthlyVolume[]
  generatedAt: string
}

interface UseProductsMetricsParams {
  from?: string
  to?: string
  limit?: number
}

async function fetchProductsMetrics(params: UseProductsMetricsParams): Promise<ProductsMetricsData> {
  const searchParams = new URLSearchParams()
  if (params.from) searchParams.set('from', params.from)
  if (params.to) searchParams.set('to', params.to)
  if (params.limit) searchParams.set('limit', params.limit.toString())

  const response = await fetch(`/api/dashboard/products-metrics?${searchParams}`)
  if (!response.ok) throw new Error('Failed to fetch products metrics')
  return response.json()
}

export function useProductsMetrics(params: UseProductsMetricsParams = {}) {
  return useQuery({
    queryKey: ['products-metrics', params.from, params.to, params.limit],
    queryFn: () => fetchProductsMetrics(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}
