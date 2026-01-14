'use client'

import { useQuery } from '@tanstack/react-query'

interface MonthlyData {
  month: string
  shipments: number
  cost: number
  claims: number
  indemnity: number
}

interface CarrierStats {
  carrier: string
  shipments: number
  totalCost: number
  avgCost: number
  claims: number
  claimRate: number
}

interface StockForecastItem {
  sku_id: string
  sku_code: string
  name: string
  current_stock: number
  avg_daily_consumption: number
  days_remaining: number | null
  estimated_stockout: string | null
  alert_threshold: number
}

export interface AnalyticsData {
  costTrend: {
    data: MonthlyData[]
    currentMonth: MonthlyData
    previousMonth: MonthlyData
    percentChange: number
    shipmentsPercentChange: number
  }
  carrierPerformance: {
    data: CarrierStats[]
    totalCarriers: number
    topCarrier: CarrierStats | null
  }
  stockForecast: {
    data: StockForecastItem[]
    criticalCount: number
    totalTracked: number
  }
  generatedAt: string
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch('/api/dashboard/analytics')
  if (!response.ok) {
    throw new Error('Failed to fetch analytics')
  }
  return response.json()
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: fetchAnalytics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}
