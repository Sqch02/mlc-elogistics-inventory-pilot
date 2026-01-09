"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StockHealthItem } from "@/types/dashboard"
import { Button } from "@/components/ui/button"
import { ArrowRight, Package } from "lucide-react"
import Link from "next/link"

interface TopSkusTableProps {
  items: StockHealthItem[]
}

export function TopSkusTable({ items }: TopSkusTableProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Top SKUs Critiques</CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" asChild>
          <Link href="/produits?filter=critique">
            Voir tout <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/30 rounded-lg">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Aucun SKU critique</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 5).map((item) => {
              const isUrgent = item.daysRemaining < 7
              const isWarning = item.daysRemaining < 14

              return (
                <div
                  key={item.sku}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-foreground truncate block" title={item.sku}>
                      {item.sku}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Stock: {item.stock}
                    </span>
                  </div>
                  <Badge
                    variant={isUrgent ? "error" : isWarning ? "warning" : "success"}
                    className="text-[10px] px-2 ml-2"
                  >
                    {item.daysRemaining}j
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
