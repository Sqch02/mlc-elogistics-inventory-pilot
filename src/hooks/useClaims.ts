'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface Claim {
  id: string
  order_ref: string | null
  description: string | null
  status: 'ouverte' | 'en_analyse' | 'indemnisee' | 'refusee' | 'cloturee'
  indemnity_eur: number | null
  opened_at: string
  shipments: {
    sendcloud_id: string
    order_ref: string | null
    carrier: string | null
  } | null
}

export interface ClaimStats {
  total: number
  open: number
  inProgress: number
  closed: number
  totalIndemnity: number
}

async function fetchClaims(): Promise<{ claims: Claim[]; stats: ClaimStats }> {
  const response = await fetch('/api/claims')
  if (!response.ok) throw new Error('Failed to fetch claims')
  const data = await response.json()

  const claims = data.claims as Claim[]

  const stats: ClaimStats = {
    total: claims.length,
    open: claims.filter(c => c.status === 'ouverte').length,
    inProgress: claims.filter(c => c.status === 'en_analyse').length,
    closed: claims.filter(c => ['indemnisee', 'refusee', 'cloturee'].includes(c.status)).length,
    totalIndemnity: claims
      .filter(c => c.status === 'indemnisee')
      .reduce((sum, c) => sum + (Number(c.indemnity_eur) || 0), 0),
  }

  return { claims, stats }
}

export function useClaims() {
  return useQuery({
    queryKey: ['claims'],
    queryFn: fetchClaims,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateClaim() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { order_ref?: string; description?: string }) => {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, status: 'ouverte' }),
      })
      if (!response.ok) throw new Error('Erreur lors de la création de la réclamation')
      return response.json()
    },
    onSuccess: () => {
      toast.success('Réclamation créée avec succès')
      queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création')
    },
  })
}

export function useUpdateClaimStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Erreur lors de la mise à jour du statut')
      return response.json()
    },
    onSuccess: () => {
      toast.success('Statut mis à jour')
      queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour')
    },
  })
}
