import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Package, DollarSign, Truck } from 'lucide-react'
import Link from 'next/link'

export interface Alert {
  id: string
  type: 'stock_critique' | 'tarif_manquant' | 'items_manquants' | 'sync_echec'
  title: string
  description: string
  count?: number
  link?: string
}

interface AlertCardProps {
  alerts: Alert[]
}

const alertConfig = {
  stock_critique: {
    icon: Package,
    color: 'bg-yellow-100 text-yellow-800',
  },
  tarif_manquant: {
    icon: DollarSign,
    color: 'bg-red-100 text-red-800',
  },
  items_manquants: {
    icon: Truck,
    color: 'bg-orange-100 text-orange-800',
  },
  sync_echec: {
    icon: AlertTriangle,
    color: 'bg-red-100 text-red-800',
  },
}

export function AlertCard({ alerts }: AlertCardProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Alertes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune alerte active
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Alertes</CardTitle>
          <Badge variant="destructive">{alerts.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = alertConfig[alert.type]
            const Icon = config.icon

            const content = (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className={`p-1.5 rounded ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    {alert.count && (
                      <Badge variant="secondary" className="text-xs">
                        {alert.count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {alert.description}
                  </p>
                </div>
              </div>
            )

            if (alert.link) {
              return (
                <Link key={alert.id} href={alert.link}>
                  {content}
                </Link>
              )
            }

            return content
          })}
        </div>
      </CardContent>
    </Card>
  )
}
