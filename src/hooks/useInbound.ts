import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface InboundEntry {
  id: string
  tenant_id: string
  sku_id: string
  qty: number
  eta_date: string
  note: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'received'
  accepted_qty: number | null
  supplier: string | null
  batch_reference: string | null
  received: boolean
  received_at: string | null
  created_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  skus: {
    id: string
    sku_code: string
    name: string
  } | null
}

export const INBOUND_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Accepte',
  rejected: 'Rejete',
  received: 'Recu',
}

export function useInbound(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['inbound', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters?.search) params.set('search', filters.search)

      const res = await fetch(`/api/inbound?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch inbound')
      const json = await res.json()
      return json.data as InboundEntry[]
    },
  })
}

export function useCreateInbound() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      sku_id: string
      qty: number
      eta_date: string
      note?: string
      supplier?: string
      batch_reference?: string
    }) => {
      const res = await fetch('/api/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur creation')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound'] })
    },
  })
}

export function useInboundAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id: string
      action: 'accept' | 'reject'
      accepted_qty?: number
      note?: string
    }) => {
      const { id, ...body } = data
      const res = await fetch(`/api/inbound/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur action')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export function useDeleteInbound() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inbound/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur suppression')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound'] })
    },
  })
}
