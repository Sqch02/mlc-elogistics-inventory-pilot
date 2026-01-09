"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StockHealthItem } from "@/types/dashboard"
import { Package } from "lucide-react"

interface StockHealthPanelProps {
  items: StockHealthItem[]
}

export function StockHealthPanel({ items }: StockHealthPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Sante Stock</CardTitle>
          {items.length > 0 && (
            <Badge variant={items.some(i => i.daysRemaining < 7) ? "error" : "warning"}>
              {items.length} alertes
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
            <div className="rounded-full bg-success/10 p-3 mb-3">
              <Package className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm font-medium">Stock sain</p>
            <p className="text-xs text-muted-foreground mt-0.5">Aucun produit critique</p>
          </div>
        ) : (
          items.slice(0, 4).map((item) => {
            const isUrgent = item.daysRemaining < 7
            const isWarning = item.daysRemaining < 14

            return (
              <div key={item.sku} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="font-medium text-sm text-foreground truncate max-w-[140px]"
                    title={item.sku}
                  >
                    {item.sku}
                  </span>
                  <Badge
                    variant={isUrgent ? "error" : isWarning ? "warning" : "success"}
                    className="text-[10px] px-2"
                  >
                    {item.daysRemaining}j
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isUrgent ? "bg-error" : isWarning ? "bg-warning" : "bg-success"
                    }`}
                    style={{ width: `${Math.min((item.daysRemaining / 30) * 100, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Stock: <span className="font-medium text-foreground">{item.stock}</span></span>
                  <span>Conso 30j: <span className="font-medium text-foreground">{item.consumption30d}</span></span>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
