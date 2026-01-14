'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Package, Calendar, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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

interface StockForecastProps {
  data: StockForecastItem[]
  criticalCount: number
  totalTracked: number
}

export function StockForecast({ data, criticalCount, totalTracked }: StockForecastProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const getUrgencyLevel = (daysRemaining: number | null): 'critical' | 'warning' | 'ok' => {
    if (daysRemaining === null) return 'ok'
    if (daysRemaining < 7) return 'critical'
    if (daysRemaining < 30) return 'warning'
    return 'ok'
  }

  const getUrgencyColor = (level: 'critical' | 'warning' | 'ok') => {
    switch (level) {
      case 'critical': return 'bg-red-500'
      case 'warning': return 'bg-amber-500'
      case 'ok': return 'bg-emerald-500'
    }
  }

  const getProgressValue = (daysRemaining: number | null) => {
    if (daysRemaining === null) return 100
    return Math.min(100, Math.max(0, (daysRemaining / 90) * 100))
  }

  // Only show items with forecasted stockout or low stock
  const urgentItems = data.filter(item =>
    item.days_remaining !== null || item.current_stock < item.alert_threshold
  ).slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Package className="h-5 w-5 text-muted-foreground" />
              Prévisions de Stock
            </CardTitle>
            <CardDescription>
              Basé sur la consommation des 90 derniers jours
            </CardDescription>
          </div>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {criticalCount} critique{criticalCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {urgentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-50" />
            <p>Tous les stocks sont à niveau optimal</p>
            <p className="text-sm">{totalTracked} SKU(s) suivis</p>
          </div>
        ) : (
          <div className="space-y-4">
            {urgentItems.map((item) => {
              const urgency = getUrgencyLevel(item.days_remaining)
              return (
                <div key={item.sku_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2 w-2 rounded-full', getUrgencyColor(urgency))} />
                      <span className="font-medium text-sm">{item.sku_code}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {item.current_stock} unités
                      </span>
                      {item.days_remaining !== null && (
                        <Badge
                          variant={urgency === 'critical' ? 'destructive' : urgency === 'warning' ? 'outline' : 'secondary'}
                          className="text-xs"
                        >
                          {item.days_remaining}j restants
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Progress
                      value={getProgressValue(item.days_remaining)}
                      className={cn(
                        'h-2',
                        urgency === 'critical' && '[&>div]:bg-red-500',
                        urgency === 'warning' && '[&>div]:bg-amber-500',
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      <span>{item.avg_daily_consumption}/jour</span>
                    </div>
                    {item.estimated_stockout && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Rupture estimée: {formatDate(item.estimated_stockout)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {data.length > 10 && (
              <p className="text-center text-sm text-muted-foreground pt-2 border-t">
                +{data.length - 10} autres SKU(s) à surveiller
              </p>
            )}
          </div>
        )}

        {/* Summary footer */}
        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">&lt; 7 jours</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">
              {data.filter(d => d.days_remaining !== null && d.days_remaining >= 7 && d.days_remaining < 30).length}
            </p>
            <p className="text-xs text-muted-foreground">7-30 jours</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-500">{totalTracked}</p>
            <p className="text-xs text-muted-foreground">Total suivis</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
