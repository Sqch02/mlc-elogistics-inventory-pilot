'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export type ClaimStatus = 'ouverte' | 'en_analyse' | 'indemnisee' | 'refusee' | 'cloturee'
export type ClaimType = 'lost' | 'damaged' | 'delay' | 'wrong_content' | 'missing_items' | 'other'
export type ClaimPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Claim {
  id: string
  order_ref: string | null
  description: string | null
  status: ClaimStatus
  claim_type: ClaimType
  priority: ClaimPriority
  indemnity_eur: number | null
  decision_note: string | null
  opened_at: string
  resolution_deadline: string | null
  decided_at: string | null
  shipments: {
    sendcloud_id: string
    order_ref: string | null
    carrier: string | null
  } | null
}

export interface ClaimHistory {
  id: string
  action: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  changed_at: string
  note: string | null
  profiles: {
    email: string
    full_name: string | null
  } | null
}

export interface ClaimStats {
  total: number
  open: number
  inProgress: number
  closed: number
  totalIndemnity: number
  byType: Record<ClaimType, number>
  byPriority: Record<ClaimPriority, number>
  overdue: number
}

export interface ClaimFilters {
  search?: string
  status?: ClaimStatus
  claim_type?: ClaimType
  priority?: ClaimPriority
  from?: string
  to?: string
}

async function fetchClaims(filters?: ClaimFilters): Promise<{ claims: Claim[]; stats: ClaimStats }> {
  const params = new URLSearchParams()
  if (filters?.search) params.set('search', filters.search)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.claim_type) params.set('claim_type', filters.claim_type)
  if (filters?.priority) params.set('priority', filters.priority)
  if (filters?.from) params.set('from', filters.from)
  if (filters?.to) params.set('to', filters.to)

  const url = `/api/claims${params.toString() ? `?${params}` : ''}`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch claims')
  const data = await response.json()

  const claims = data.claims as Claim[]
  const now = new Date()

  const stats: ClaimStats = {
    total: claims.length,
    open: claims.filter(c => c.status === 'ouverte').length,
    inProgress: claims.filter(c => c.status === 'en_analyse').length,
    closed: claims.filter(c => ['indemnisee', 'refusee', 'cloturee'].includes(c.status)).length,
    totalIndemnity: claims
      .filter(c => c.status === 'indemnisee')
      .reduce((sum, c) => sum + (Number(c.indemnity_eur) || 0), 0),
    byType: {
      lost: claims.filter(c => c.claim_type === 'lost').length,
      damaged: claims.filter(c => c.claim_type === 'damaged').length,
      delay: claims.filter(c => c.claim_type === 'delay').length,
      wrong_content: claims.filter(c => c.claim_type === 'wrong_content').length,
      missing_items: claims.filter(c => c.claim_type === 'missing_items').length,
      other: claims.filter(c => c.claim_type === 'other' || !c.claim_type).length,
    },
    byPriority: {
      urgent: claims.filter(c => c.priority === 'urgent').length,
      high: claims.filter(c => c.priority === 'high').length,
      normal: claims.filter(c => c.priority === 'normal' || !c.priority).length,
      low: claims.filter(c => c.priority === 'low').length,
    },
    overdue: claims.filter(c =>
      c.resolution_deadline &&
      new Date(c.resolution_deadline) < now &&
      !['indemnisee', 'refusee', 'cloturee'].includes(c.status)
    ).length,
  }

  return { claims, stats }
}

export function useClaims(filters?: ClaimFilters) {
  return useQuery({
    queryKey: ['claims', filters],
    queryFn: () => fetchClaims(filters),
    staleTime: 2 * 60 * 1000,
  })
}

export function useClaimHistory(claimId: string) {
  return useQuery({
    queryKey: ['claim-history', claimId],
    queryFn: async () => {
      const response = await fetch(`/api/claims/${claimId}`)
      if (!response.ok) throw new Error('Failed to fetch claim')
      const data = await response.json()
      return data.history as ClaimHistory[]
    },
    enabled: !!claimId,
  })
}

export function useCreateClaim() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      shipment_id?: string
      order_ref?: string
      description?: string
      claim_type?: ClaimType
      priority?: ClaimPriority
    }) => {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, status: 'ouverte' }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur lors de la creation')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Réclamation créée')
      queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateClaim() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string
      status?: ClaimStatus
      description?: string | null
      indemnity_eur?: number | null
      decision_note?: string | null
      claim_type?: ClaimType
      priority?: ClaimPriority
    }) => {
      const response = await fetch(`/api/claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur lors de la mise a jour')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Réclamation mise à jour')
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      queryClient.invalidateQueries({ queryKey: ['claim-history'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// Alias for backwards compatibility
export function useUpdateClaimStatus() {
  return useUpdateClaim()
}

export function useBulkUpdateClaims() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ids, data }: {
      ids: string[]
      data: {
        status?: ClaimStatus
        priority?: ClaimPriority
        claim_type?: ClaimType
      }
    }) => {
      const results = await Promise.all(
        ids.map(id =>
          fetch(`/api/claims/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        )
      )
      const failed = results.filter(r => !r.ok).length
      if (failed > 0) {
        throw new Error(`${failed} réclamation(s) n'ont pas pu être mises à jour`)
      }
      return { success: true, count: ids.length }
    },
    onSuccess: (data) => {
      toast.success(`${data.count} réclamation(s) mise(s) à jour`)
      queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useDeleteClaim() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/claims/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Réclamation supprimée')
      queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// Labels helpers
export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  lost: 'Colis perdu',
  damaged: 'Colis endommagé',
  delay: 'Retard de livraison',
  wrong_content: 'Contenu erroné',
  missing_items: 'Articles manquants',
  other: 'Autre',
}

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  ouverte: 'Ouverte',
  en_analyse: 'En analyse',
  indemnisee: 'Indemnisée',
  refusee: 'Refusée',
  cloturee: 'Clôturée',
}

export const CLAIM_PRIORITY_LABELS: Record<ClaimPriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
}
