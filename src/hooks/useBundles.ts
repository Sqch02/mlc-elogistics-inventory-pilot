'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface BundleComponent {
  id?: string
  qty_component: number
  component_sku_id?: string
  component_sku: { sku_code: string; name: string } | null
}

export interface Bundle {
  id: string
  bundle_sku_id: string
  bundle_sku: { sku_code: string; name: string } | null
  components: BundleComponent[]
}

async function fetchBundles(): Promise<{ bundles: Bundle[] }> {
  const response = await fetch('/api/bundles')
  if (!response.ok) throw new Error('Failed to fetch bundles')
  const data = await response.json()
  return { bundles: data.bundles || [] }
}

export function useBundles() {
  return useQuery({
    queryKey: ['bundles'],
    queryFn: fetchBundles,
    staleTime: 5 * 60 * 1000,
  })
}

// Create bundle mutation
export function useCreateBundle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      bundle_sku_code: string
      components: Array<{ sku_code: string; qty: number }>
    }) => {
      const response = await fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur création bundle')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['skus'] })
    },
  })
}

// Update bundle mutation
export function useUpdateBundle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      components
    }: {
      id: string
      components: Array<{ sku_code: string; qty: number }>
    }) => {
      const response = await fetch(`/api/bundles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur mise à jour bundle')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['skus'] })
    },
  })
}

// Delete bundle mutation
export function useDeleteBundle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/bundles/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur suppression bundle')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['skus'] })
    },
  })
}
