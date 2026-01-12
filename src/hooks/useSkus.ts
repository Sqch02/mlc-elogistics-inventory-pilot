'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface SKU {
  id: string
  sku_code: string
  name: string
  weight_grams: number | null
  alert_threshold: number
  qty_current: number
  stock_updated_at: string | null
  created_at: string
}

async function fetchSkus(): Promise<{ skus: SKU[] }> {
  const response = await fetch('/api/skus')
  if (!response.ok) throw new Error('Failed to fetch SKUs')
  return response.json()
}

export function useSkus() {
  return useQuery({
    queryKey: ['skus'],
    queryFn: fetchSkus,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateSku() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      sku_code: string
      name: string
      weight_grams?: number
      alert_threshold?: number
      qty_initial?: number
    }) => {
      const response = await fetch('/api/skus', {
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
      toast.success('Produit créé avec succès')
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateSku() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string
      sku_code?: string
      name?: string
      weight_grams?: number
      alert_threshold?: number
    }) => {
      const response = await fetch(`/api/skus/${id}`, {
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
      toast.success('Produit mis à jour')
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useDeleteSku() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/skus/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la suppression')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Produit supprimé')
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useAdjustStock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, qty_current, adjustment, reason, movement_type }: {
      id: string
      qty_current?: number
      adjustment?: number
      reason?: string
      movement_type?: 'manual' | 'restock' | 'correction' | 'import'
    }) => {
      const response = await fetch(`/api/skus/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_current, adjustment, reason, movement_type }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de l\'ajustement')
      }
      return response.json()
    },
    onSuccess: (data, variables) => {
      toast.success(`Stock mis à jour: ${data.previous_qty} → ${data.new_qty}`)
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['sku-movements', variables.id] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// Types for stock movements
export interface StockMovement {
  id: string
  qty_before: number
  qty_after: number
  adjustment: number
  movement_type: 'manual' | 'shipment' | 'restock' | 'correction' | 'import'
  reason: string | null
  reference_id: string | null
  reference_type: string | null
  created_at: string
  user: {
    name: string
  }
}

export interface SkuMovementsResponse {
  sku: {
    id: string
    sku_code: string
    name: string
  }
  movements: StockMovement[]
  total: number
  limit: number
  offset: number
}

async function fetchSkuMovements(skuId: string): Promise<SkuMovementsResponse> {
  const response = await fetch(`/api/skus/${skuId}/movements`)
  if (!response.ok) throw new Error('Failed to fetch movements')
  return response.json()
}

export function useSkuMovements(skuId: string | null) {
  return useQuery({
    queryKey: ['sku-movements', skuId],
    queryFn: () => fetchSkuMovements(skuId!),
    enabled: !!skuId,
    staleTime: 30 * 1000, // 30 seconds
  })
}
