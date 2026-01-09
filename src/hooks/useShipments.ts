'use client'

import { useQuery } from '@tanstack/react-query'

export interface ShipmentFilters {
  from?: string
  to?: string
  carrier?: string
  pricing_status?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ShipmentStats {
  totalCost: number
  totalValue: number
  missingPricing: number
}

export interface Shipment {
  id: string
  sendcloud_id: string
  shipped_at: string
  carrier: string
  service: string | null
  weight_grams: number
  order_ref: string | null
  tracking: string | null
  pricing_status: 'ok' | 'missing' | 'error'
  computed_cost_eur: number | null
  total_value: number | null
  currency: string | null
  recipient_name: string | null
  recipient_email: string | null
  recipient_phone: string | null
  recipient_company: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postal_code: string | null
  country_code: string | null
  country_name: string | null
  status_id: number | null
  status_message: string | null
  tracking_url: string | null
  label_url: string | null
  service_point_id: string | null
  is_return: boolean | null
  collo_count: number | null
  external_order_id: string | null
  date_created: string | null
  date_updated: string | null
  date_announced: string | null
  shipment_items: Array<{
    qty: number
    skus: { sku_code: string; name: string } | null
  }>
}

async function fetchShipments(filters: ShipmentFilters): Promise<{ shipments: Shipment[]; carriers: string[]; pagination: Pagination; stats: ShipmentStats }> {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.carrier) params.set('carrier', filters.carrier)
  if (filters.pricing_status) params.set('pricing_status', filters.pricing_status)
  if (filters.search) params.set('search', filters.search)
  params.set('page', String(filters.page || 1))
  params.set('pageSize', String(filters.pageSize || 100))

  const response = await fetch(`/api/shipments?${params.toString()}`)
  if (!response.ok) throw new Error('Failed to fetch shipments')

  const data = await response.json()

  // Extract unique carriers
  const carriers = [...new Set(data.shipments.map((s: Shipment) => s.carrier).filter(Boolean))] as string[]

  return {
    shipments: data.shipments,
    carriers,
    pagination: data.pagination || { page: 1, pageSize: 100, total: data.shipments.length, totalPages: 1 },
    stats: data.stats || { totalCost: 0, totalValue: 0, missingPricing: 0 }
  }
}

export function useShipments(filters: ShipmentFilters = {}) {
  return useQuery({
    queryKey: ['shipments', filters],
    queryFn: () => fetchShipments(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useCarriers() {
  return useQuery({
    queryKey: ['carriers'],
    queryFn: async () => {
      const response = await fetch('/api/shipments?limit=1000')
      if (!response.ok) throw new Error('Failed to fetch carriers')
      const data = await response.json()
      return [...new Set(data.shipments.map((s: Shipment) => s.carrier).filter(Boolean))] as string[]
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - carriers don't change often
  })
}
