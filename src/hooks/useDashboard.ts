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
    staleTime: 10 * 60 * 1000, // 10 min (data refreshed every 5 min by cron)
    gcTime: 15 * 60 * 1000,
  })
}
