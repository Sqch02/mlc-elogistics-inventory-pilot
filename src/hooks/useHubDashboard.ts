'use client'

import { useQuery } from '@tanstack/react-query'

export interface HubTenantMetrics {
  id: string
  name: string
  code: string | null
  shipments: number
  cost: number
  missingPricing: number
  criticalStock: number
  userCount: number
  lastSync: { date: string; status: string } | null
}

export interface HubDashboardData {
  tenants: HubTenantMetrics[]
  totals: {
    shipments: number
    cost: number
    missingPricing: number
    criticalStock: number
  }
  month: string
}

async function fetchHubDashboard(): Promise<HubDashboardData> {
  const response = await fetch('/api/hub/dashboard')
  if (!response.ok) throw new Error('Failed to fetch hub dashboard')
  return response.json()
}

export function useHubDashboard() {
  return useQuery({
    queryKey: ['hub-dashboard'],
    queryFn: fetchHubDashboard,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
