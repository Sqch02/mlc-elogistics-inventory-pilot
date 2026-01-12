'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface Location {
  id: string
  code: string
  label: string | null
  active: boolean
  // Champs pour vue visuelle
  zone_code: string
  row_number: number
  col_number: number
  height_level: string
  content: string | null
  expiry_date: string | null
  status: 'occupied' | 'empty' | 'blocked'
  max_weight_kg: number | null
  assignment: {
    sku: { sku_code: string; name: string } | null
  } | null
}

export interface ZoneGrid {
  zone_code: string
  zone_label: string
  rows: number
  cols: number
  heights: string[]
  cells: Location[]
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
      // Nouveaux champs visuels
      zone_code?: string
      row_number?: number
      col_number?: number
      height_level?: string
      content?: string | null
      expiry_date?: string | null
      status?: 'occupied' | 'empty' | 'blocked'
      max_weight_kg?: number | null
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
      queryClient.invalidateQueries({ queryKey: ['locations-by-zone'] })
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

// Helper pour les labels de zone
function getZoneLabel(zoneCode: string): string {
  const labels: Record<string, string> = {
    'ENTREPOT': 'Entrepôt',
    'ALLEE1': 'Allée 1',
    'ALLEE2': 'Allée 2',
    'ALLEE3': 'Allée 3',
    'PICKING': 'Zone Picking',
    'ZONE1': 'Zone 1',
  }
  return labels[zoneCode] || zoneCode
}

// Hook pour récupérer les emplacements groupés par zone
export function useLocationsByZone() {
  return useQuery({
    queryKey: ['locations-by-zone'],
    queryFn: async (): Promise<ZoneGrid[]> => {
      const response = await fetch('/api/locations')
      if (!response.ok) throw new Error('Failed to fetch locations')
      const data = await response.json()
      const locations = data.locations as Location[]

      // Grouper par zone
      const zonesMap = new Map<string, ZoneGrid>()

      for (const loc of locations) {
        const zoneCode = loc.zone_code || 'ZONE1'

        if (!zonesMap.has(zoneCode)) {
          zonesMap.set(zoneCode, {
            zone_code: zoneCode,
            zone_label: getZoneLabel(zoneCode),
            rows: 0,
            cols: 0,
            heights: [],
            cells: [],
          })
        }

        const zone = zonesMap.get(zoneCode)!
        zone.cells.push(loc)
        zone.rows = Math.max(zone.rows, loc.row_number || 1)
        zone.cols = Math.max(zone.cols, loc.col_number || 1)

        // Collecter les niveaux de hauteur uniques
        const height = loc.height_level || 'A'
        if (!zone.heights.includes(height)) {
          zone.heights.push(height)
        }
      }

      // Trier les hauteurs (D, C, B, A) et les zones
      for (const zone of zonesMap.values()) {
        zone.heights.sort().reverse() // D, C, B, A
      }

      return Array.from(zonesMap.values()).sort((a, b) =>
        a.zone_code.localeCompare(b.zone_code)
      )
    },
    staleTime: 5 * 60 * 1000,
  })
}
