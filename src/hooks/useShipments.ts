'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface ShipmentFilters {
  from?: string
  to?: string
  carrier?: string
  pricing_status?: string
  shipment_status?: 'pending' | 'shipped' // pending = On Hold, shipped = has tracking
  delivery_status?: 'in_transit' | 'delivered' | 'issue' // issue = problem statuses
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
  has_error: boolean | null
  error_message: string | null
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
  if (filters.shipment_status) params.set('shipment_status', filters.shipment_status)
  if (filters.delivery_status) params.set('delivery_status', filters.delivery_status)
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

/**
 * Cancel a shipment in Sendcloud
 */
export function useCancelShipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const response = await fetch(`/api/shipments/${shipmentId}/cancel`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de l\'annulation')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Expédition annulée')
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

/**
 * Refresh a shipment from Sendcloud
 */
export function useRefreshShipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const response = await fetch(`/api/shipments/${shipmentId}/refresh`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors du rafraîchissement')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(`Statut mis à jour: ${data.status_message || 'OK'}`)
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// Types for creating a shipment
export interface CreateShipmentData {
  // Recipient
  name: string
  email?: string
  telephone?: string
  company_name?: string

  // Address
  address: string
  address_2?: string
  city: string
  postal_code: string
  country: string // ISO 2 code (FR, BE, etc.)

  // Shipment
  weight: number // in grams
  order_number?: string
  shipment_id?: number // Sendcloud shipping method ID
  request_label?: boolean

  // Items (optional)
  items?: Array<{
    sku_code: string
    qty: number
    description?: string
    weight?: number
    value?: number
  }>
}

export interface CreateShipmentResponse {
  success: boolean
  message?: string
  warning?: string
  shipment?: {
    id: string
    sendcloud_id: string
    tracking: string | null
    tracking_url: string | null
    label_url: string | null
    carrier: string
    status: string | null
  }
  error?: string
  details?: string[]
}

/**
 * Create a new shipment in Sendcloud
 */
export function useCreateShipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateShipmentData): Promise<CreateShipmentResponse> => {
      const response = await fetch('/api/shipments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création')
      }

      return result
    },
    onSuccess: (data) => {
      if (data.warning) {
        toast.warning(data.warning)
      } else {
        toast.success(data.message || 'Expédition créée avec succès')
      }
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// Types for updating a shipment
export interface UpdateShipmentData {
  recipient_name?: string
  recipient_email?: string
  recipient_phone?: string
  recipient_company?: string
  address_line1?: string
  address_line2?: string
  city?: string
  postal_code?: string
  country_code?: string
  order_ref?: string
  weight_grams?: number
}

/**
 * Update a shipment in Sendcloud (syncs modifications)
 * Only works for shipments that haven't been shipped yet
 */
export function useUpdateShipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateShipmentData }) => {
      const response = await fetch(`/api/shipments/${id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la mise à jour')
      }

      return result
    },
    onSuccess: () => {
      toast.success('Expédition mise à jour dans Sendcloud')
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
