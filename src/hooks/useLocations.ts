'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface Location {
  id: string
  code: string
  label: string | null
  active: boolean
  assignment: {
    sku: { sku_code: string; name: string } | null
  } | null
}

export interface LocationStats {
  total: number
  occupied: number
  empty: number
  active: number
  occupancyRate: number
}

async function fetchLocations(): Promise<{ locations: Location[]; stats: LocationStats }> {
  const response = await fetch('/api/locations')
  if (!response.ok) throw new Error('Failed to fetch locations')
  const data = await response.json()

  const locations = data.locations as Location[]

  const stats: LocationStats = {
    total: locations.length,
    occupied: locations.filter(l => l.assignment).length,
    empty: locations.filter(l => !l.assignment).length,
    active: locations.filter(l => l.active).length,
    occupancyRate: locations.length > 0
      ? Math.round((locations.filter(l => l.assignment).length / locations.length) * 100)
      : 0,
  }

  return { locations, stats }
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      code: string
      label?: string
      active?: boolean
    }) => {
      const response = await fetch('/api/locations', {
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
      toast.success('Emplacement créé')
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string
      code?: string
      label?: string
      active?: boolean
      sku_code?: string | null // null to unassign
    }) => {
      const response = await fetch(`/api/locations/${id}`, {
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
      toast.success('Emplacement mis à jour')
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      queryClient.invalidateQueries({ queryKey: ['skus'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useDeleteLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/locations/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la suppression')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Emplacement supprimé')
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
