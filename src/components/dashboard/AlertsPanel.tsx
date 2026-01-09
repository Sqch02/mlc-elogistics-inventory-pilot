"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Package, DollarSign, Truck, ArrowRight, ExternalLink } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { DashboardAlert } from "@/types/dashboard"
import Link from "next/link"

interface AlertsPanelProps {
  alerts: DashboardAlert[]
}

const alertConfig = {
  stock_critique: {
    icon: Package,
    color: 'bg-red-50 text-red-700',
    borderColor: 'border-red-100'
  },
  tarif_manquant: {
    icon: DollarSign,
    color: 'bg-amber-50 text-amber-700',
    borderColor: 'border-amber-100'
  },
  items_manquants: {
    icon: Truck,
    color: 'bg-gray-50 text-gray-700',
    borderColor: 'border-gray-100'
  },
  sync_echec: {
    icon: AlertTriangle,
    color: 'bg-red-50 text-red-700',
    borderColor: 'border-red-100'
  },
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <Card className="shadow-sm border-border h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Alertes</CardTitle>
        <Badge variant={alerts.length > 0 ? "destructive" : "secondary"}>
          {alerts.length}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
             <div className="rounded-full bg-green-100 p-2 mb-2">
               <AlertTriangle className="h-4 w-4 text-green-600" />
             </div>
             <p className="text-sm font-medium">Aucune alerte</p>
           </div>
        ) : (
          alerts.map((alert) => {
            const config = alertConfig[alert.type]
            const Icon = config.icon

            return (
              <div 
                key={alert.id}
                className={`flex flex-col gap-2 p-3 rounded-lg border ${config.borderColor} bg-white hover:bg-muted/10 transition-colors shadow-sm`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{alert.title}</h4>
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                  </div>
                </div>
                
                {alert.actionLink && (
                  <Button variant="outline" size="sm" className="w-full justify-between h-7 mt-1 text-[11px] font-medium bg-white" asChild>
                    <Link href={alert.actionLink}>
                      {alert.actionLabel || "Voir"}
                      <ArrowRight className="h-3 w-3 ml-2 opacity-50" />
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
