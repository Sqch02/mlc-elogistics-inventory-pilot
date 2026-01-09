"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StockHealthItem } from "@/types/dashboard"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

interface TopSkusTableProps {
  items: StockHealthItem[]
}

export function TopSkusTable({ items }: TopSkusTableProps) {
  return (
    <Card className="shadow-sm border-border flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Top SKUs Critiques</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" asChild>
          <Link href="/produits?filter=critique">
            Tout voir <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Aucune donnée disponible
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="h-9 text-[11px] font-semibold pl-6">SKU</TableHead>
                <TableHead className="h-9 text-[11px] font-semibold text-right">Stock</TableHead>
                <TableHead className="h-9 text-[11px] font-semibold text-right pr-6">Restant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(0, 5).map((item) => (
                <TableRow key={item.sku} className="hover:bg-muted/30 border-b border-border/50 last:border-0 h-10">
                  <TableCell className="font-medium text-xs pl-6 py-2">{item.sku}</TableCell>
                  <TableCell className="text-right text-xs py-2 text-muted-foreground">{item.stock}</TableCell>
                  <TableCell className="text-right py-2 pr-6">
                    <Badge variant={
                      item.daysRemaining < 7 ? "destructive" :
                      item.daysRemaining < 14 ? "warning" : "success"
                    } className="h-5 px-1.5 text-[10px]">
                      {item.daysRemaining}j
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
