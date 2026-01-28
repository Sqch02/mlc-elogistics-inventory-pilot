'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CostTrendChart } from '@/components/dashboard/CostTrendChart'
import { CarrierPerformance } from '@/components/dashboard/CarrierPerformance'
import {
  TrendingUp,
  TrendingDown,
  Truck,
  Euro,
  Package,
  AlertTriangle,
  BarChart3,
  Clock,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface AnalyticsData {
  costTrend: {
    data: Array<{
      month: string
      shipments: number
      cost: number
      claims: number
      indemnity: number
    }>
    currentMonth: {
      month: string
      shipments: number
      cost: number
      claims: number
      indemnity: number
    }
    previousMonth: {
      month: string
      shipments: number
      cost: number
      claims: number
      indemnity: number
    }
    percentChange: number
    shipmentsPercentChange: number
  }
  carrierPerformance: {
    data: Array<{
      carrier: string
      shipments: number
      totalCost: number
      avgCost: number
      claims: number
      claimRate: number
    }>
    totalCarriers: number
  }
  stockForecast: {
    data: Array<{
      sku_id: string
      sku_code: string
      name: string
      current_stock: number
      avg_daily_consumption: number
      days_remaining: number | null
      estimated_stockout: string | null
      alert_threshold: number
    }>
    criticalCount: number
    totalTracked: number
  }
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await fetch('/api/dashboard/analytics')
  if (!res.ok) throw new Error('Failed to fetch analytics')
  return res.json()
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function TrendBadge({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown

  return (
    <Badge variant={isPositive ? 'success' : value < 0 ? 'error' : 'muted'} className="gap-1">
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}{value}%
    </Badge>
  )
}

function getDaysColor(days: number | null) {
  if (days === null) return 'text-muted-foreground'
  if (days <= 7) return 'text-red-600'
  if (days <= 14) return 'text-amber-600'
  if (days <= 30) return 'text-yellow-600'
  return 'text-emerald-600'
}

function getDaysProgress(days: number | null) {
  if (days === null) return 100
  if (days >= 90) return 100
  return Math.min(100, (days / 90) * 100)
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (isLoading) {
    return <AnalyticsLoadingSkeleton />
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Erreur lors du chargement des analytics</p>
      </div>
    )
  }

  // Calculate YTD totals
  const ytdShipments = data.costTrend.data.reduce((sum, m) => sum + m.shipments, 0)
  const ytdCost = data.costTrend.data.reduce((sum, m) => sum + m.cost, 0)
  const ytdIndemnity = data.costTrend.data.reduce((sum, m) => sum + m.indemnity, 0)
  const avgCostPerShipment = ytdShipments > 0 ? ytdCost / ytdShipments : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          Vue d&apos;ensemble des performances et tendances
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase">Expeditions (12 mois)</p>
                <p className="text-2xl font-bold">{ytdShipments.toLocaleString('fr-FR')}</p>
                <TrendBadge value={data.costTrend.shipmentsPercentChange} />
              </div>
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Truck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase">Cout total (12 mois)</p>
                <p className="text-2xl font-bold">{formatEuro(ytdCost)}</p>
                <TrendBadge value={data.costTrend.percentChange} inverse />
              </div>
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <Euro className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase">Cout moyen / exp.</p>
                <p className="text-2xl font-bold">{formatEuro(avgCostPerShipment)}</p>
                <p className="text-xs text-muted-foreground">moyenne sur 12 mois</p>
              </div>
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase">Indemnites (12 mois)</p>
                <p className="text-2xl font-bold">{formatEuro(ytdIndemnity)}</p>
                <p className="text-xs text-muted-foreground">
                  {data.costTrend.data.reduce((sum, m) => sum + m.claims, 0)} reclamations
                </p>
              </div>
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostTrendChart
          data={data.costTrend.data}
          percentChange={data.costTrend.percentChange}
          shipmentsPercentChange={data.costTrend.shipmentsPercentChange}
        />

        <CarrierPerformance
          data={data.carrierPerformance.data}
          totalCarriers={data.carrierPerformance.totalCarriers}
        />
      </div>

      {/* Stock Forecast */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Prevision Stock
              </CardTitle>
              <CardDescription>
                Estimation des ruptures basee sur la consommation des 90 derniers jours
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={data.stockForecast.criticalCount > 0 ? 'warning' : 'success'}>
                {data.stockForecast.criticalCount} critique(s)
              </Badge>
              <Badge variant="muted">{data.stockForecast.totalTracked} produits suivis</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.stockForecast.data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune donnee de stock disponible</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.stockForecast.data.slice(0, 10).map((item) => (
                <div
                  key={item.sku_id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm">{item.sku_code}</span>
                      {item.days_remaining !== null && item.days_remaining <= 14 && (
                        <Badge variant="warning" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                  </div>

                  <div className="text-right w-24">
                    <p className="font-medium">{item.current_stock}</p>
                    <p className="text-xs text-muted-foreground">en stock</p>
                  </div>

                  <div className="text-right w-24">
                    <p className="font-medium">{item.avg_daily_consumption.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">/ jour</p>
                  </div>

                  <div className="w-32">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${getDaysColor(item.days_remaining)}`}>
                        {item.days_remaining !== null ? `${item.days_remaining}j` : '∞'}
                      </span>
                      {item.estimated_stockout && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.estimated_stockout).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>
                    <Progress
                      value={getDaysProgress(item.days_remaining)}
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-5 w-16" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-[300px] w-full" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-[200px] w-full" />
        </Card>
      </div>

      <Card className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}
