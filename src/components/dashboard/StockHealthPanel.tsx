"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StockHealthItem } from "@/types/dashboard"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

interface StockHealthPanelProps {
  items: StockHealthItem[]
}

export function StockHealthPanel({ items }: StockHealthPanelProps) {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Santé Stock</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6 bg-muted/20 rounded-lg border border-dashed">
            Aucun stock critique
          </div>
        ) : (
          items.slice(0, 4).map((item) => (
            <div key={item.sku} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground truncate max-w-[120px]" title={item.sku}>
                  {item.sku}
                </span>
                <Badge variant={
                  item.daysRemaining < 7 ? "destructive" :
                  item.daysRemaining < 14 ? "warning" : "success"
                } className="h-5 px-2 text-[10px] font-medium">
                  {item.daysRemaining}j restants
                </Badge>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.daysRemaining < 7 ? "bg-error" :
                    item.daysRemaining < 14 ? "bg-warning" : "bg-success"
                  }`}
                  style={{ width: `${Math.min((item.daysRemaining / 30) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                <span>Stock: {item.stock}</span>
                <span>Conso 30j: {item.consumption30d}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
