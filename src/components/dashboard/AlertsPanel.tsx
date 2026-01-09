"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Package, DollarSign, Truck, ArrowRight, CheckCircle } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { DashboardAlert } from "@/types/dashboard"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface AlertsPanelProps {
  alerts: DashboardAlert[]
}

const alertConfig = {
  stock_critique: {
    icon: Package,
    bg: 'bg-error/5',
    iconBg: 'bg-error/10',
    iconColor: 'text-error',
    border: 'border-error/20'
  },
  tarif_manquant: {
    icon: DollarSign,
    bg: 'bg-warning/5',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    border: 'border-warning/20'
  },
  items_manquants: {
    icon: Truck,
    bg: 'bg-muted',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    border: 'border-border'
  },
  sync_echec: {
    icon: AlertTriangle,
    bg: 'bg-error/5',
    iconBg: 'bg-error/10',
    iconColor: 'text-error',
    border: 'border-error/20'
  },
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Alertes</CardTitle>
        <Badge variant={alerts.length > 0 ? "error" : "success"}>
          {alerts.length}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-success/5 rounded-lg">
            <div className="rounded-full bg-success/10 p-3 mb-3">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground">Tout est en ordre</p>
            <p className="text-xs text-muted-foreground mt-0.5">Aucune alerte active</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const config = alertConfig[alert.type]
            const Icon = config.icon

            return (
              <div
                key={alert.id}
                className={cn(
                  "flex flex-col gap-3 p-3 rounded-lg border transition-colors",
                  config.bg,
                  config.border
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", config.iconBg)}>
                    <Icon className={cn("h-4 w-4", config.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground">{alert.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                  </div>
                </div>

                {alert.actionLink && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between h-8 text-xs font-medium bg-white/80 hover:bg-white"
                    asChild
                  >
                    <Link href={alert.actionLink}>
                      {alert.actionLabel || "Voir les details"}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
