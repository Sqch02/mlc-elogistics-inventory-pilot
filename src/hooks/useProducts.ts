'use client'

import { useQuery } from '@tanstack/react-query'

export interface ProductFilters {
  search?: string
  status?: string
}

export interface Product {
  sku_code: string
  name: string
  description: string | null
  unit_cost_eur?: number | null
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

export interface ProductStats {
  totalSkus: number
  totalStock: number
  totalConsumption30d: number
  criticalCount: number
}

async function fetchProducts(filters: ProductFilters): Promise<{ skus: Product[]; stats: ProductStats }> {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)

  const response = await fetch(`/api/products?${params.toString()}`)
  if (!response.ok) throw new Error('Failed to fetch products')

  const data = await response.json()

  // Calculate stats
  const skus = (data.skus || []) as Product[]
  const stats: ProductStats = {
    totalSkus: skus.length,
    totalStock: skus.reduce((sum, s) => sum + (s.qty_current || 0), 0),
    totalConsumption30d: skus.reduce((sum, s) => sum + (s.consumption_30d || 0), 0),
    criticalCount: skus.filter(s => s.status === 'critical' || s.status === 'rupture').length,
  }

  return { skus, stats }
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => fetchProducts(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}
