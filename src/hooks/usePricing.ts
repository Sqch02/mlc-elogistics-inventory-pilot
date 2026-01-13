'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface PricingRule {
  id: string
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

// Labels pour les destinations
export const DESTINATION_LABELS: Record<string, string> = {
  france_domicile: 'France',
  belgique: 'Belgique',
  suisse: 'Suisse',
  eu_dom: 'EU (autres)',
  monde: 'International',
}

export interface PricingStats {
  totalRules: number
  carriers: string[]
  destinations: string[]
  missingPricingCount: number
}

async function fetchPricing(): Promise<{ rules: PricingRule[]; stats: PricingStats }> {
  const response = await fetch('/api/pricing')
  if (!response.ok) throw new Error('Failed to fetch pricing')
  const data = await response.json()

  const rules = data.rules as PricingRule[]
  const carriers = [...new Set(rules.map(r => r.carrier))]
  const destinations = [...new Set(rules.map(r => r.destination).filter(Boolean))] as string[]

  const stats: PricingStats = {
    totalRules: rules.length,
    carriers,
    destinations,
    missingPricingCount: data.missingPricingCount || 0,
  }

  return { rules, stats }
}

export function usePricing() {
  return useQuery({
    queryKey: ['pricing'],
    queryFn: fetchPricing,
    staleTime: 5 * 60 * 1000, // 5 minutes - pricing doesn't change often
  })
}

export function useCreatePricingRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      carrier: string
      destination?: string | null
      weight_min_grams: number
      weight_max_grams: number
      price_eur: number
    }) => {
      const response = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la création')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Règle tarifaire créée')
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdatePricingRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string
      carrier?: string
      destination?: string | null
      weight_min_grams?: number
      weight_max_grams?: number
      price_eur?: number
    }) => {
      const response = await fetch(`/api/pricing/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la mise à jour')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Règle mise à jour')
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useDeletePricingRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pricing/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la suppression')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Règle supprimée')
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
