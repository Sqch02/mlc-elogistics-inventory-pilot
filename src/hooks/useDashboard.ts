'use client'

import { useQuery } from '@tanstack/react-query'
import type { DashboardData } from '@/types/dashboard'

async function fetchDashboard(month?: string): Promise<DashboardData> {
  const params = month ? `?month=${month}` : ''
  const response = await fetch(`/api/dashboard${params}`)
  if (!response.ok) throw new Error('Failed to fetch dashboard')
  return response.json()
}

export function useDashboard(month?: string) {
  return useQuery({
    queryKey: ['dashboard', month],
    queryFn: () => fetchDashboard(month),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}
