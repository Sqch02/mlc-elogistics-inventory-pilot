'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export type ReturnStatus = 'announced' | 'ready' | 'in_transit' | 'delivered' | 'cancelled' | 'at_carrier'
export type ReturnReason = 'refund' | 'exchange' | 'defective' | 'wrong_item' | 'other'

export interface Return {
  id: string
  sendcloud_id: string
  sendcloud_return_id: string | null
  order_ref: string | null
  original_shipment_id: string | null
  tracking_number: string | null
  tracking_url: string | null
  carrier: string | null
  service: string | null
  status: ReturnStatus
  status_message: string | null
  sender_name: string | null
  sender_email: string | null
  sender_phone: string | null
  sender_company: string | null
  sender_address: string | null
  sender_city: string | null
  sender_postal_code: string | null
  sender_country_code: string | null
  return_reason: ReturnReason | null
  return_reason_comment: string | null
  created_at: string
  announced_at: string | null
  delivered_at: string | null
}

export interface ReturnStats {
  total: number
  announced: number
  in_transit: number
  delivered: number
  byReason: {
    refund: number
    exchange: number
    defective: number
    wrong_item: number
    other: number
  }
}

export interface ReturnFilters {
  search?: string
  status?: ReturnStatus
  reason?: ReturnReason
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

interface ReturnsResponse {
  returns: Return[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  stats: ReturnStats
}

async function fetchReturns(filters?: ReturnFilters): Promise<ReturnsResponse> {
  const params = new URLSearchParams()
  if (filters?.search) params.set('search', filters.search)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.reason) params.set('reason', filters.reason)
  if (filters?.from) params.set('from', filters.from)
  if (filters?.to) params.set('to', filters.to)
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize))

  const url = `/api/returns${params.toString() ? `?${params}` : ''}`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch returns')
  return response.json()
}

export function useReturns(filters?: ReturnFilters) {
  return useQuery({
    queryKey: ['returns', filters],
    queryFn: () => fetchReturns(filters),
    staleTime: 2 * 60 * 1000,
  })
}

export function useSyncReturns() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/returns/sync', {
        method: 'POST',
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Erreur de synchronisation')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Synchronisation terminée')
      queryClient.invalidateQueries({ queryKey: ['returns'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// Labels helpers
export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  announced: 'Déclaré',
  ready: 'Prêt à l\'envoi',
  in_transit: 'En transit',
  delivered: 'Livré',
  cancelled: 'Annulé',
  at_carrier: 'Chez transporteur',
}

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  refund: 'Remboursement',
  exchange: 'Échange',
  defective: 'Défectueux',
  wrong_item: 'Mauvais article',
  other: 'Autre',
}
