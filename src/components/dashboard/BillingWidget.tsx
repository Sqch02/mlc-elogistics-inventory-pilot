"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BillingSummary } from "@/types/dashboard"
import { FileText, Download, CheckCircle2, Clock } from "lucide-react"

interface BillingWidgetProps {
  data: BillingSummary
  month: string
}

export function BillingWidget({ data, month }: BillingWidgetProps) {
  const monthName = new Date(month).toLocaleDateString('fr-FR', { month: 'long' })

  return (
    <Card className="shadow-sm border-border h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold capitalize">{monthName}</CardTitle>
        <Badge variant={
          data.status === 'generated' ? 'success' :
          data.status === 'exported' ? 'default' : 'secondary'
        } className="capitalize">
          {data.status === 'pending' ? 'En attente' : data.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Transport</span>
            <p className="text-lg font-bold text-foreground">{data.totalCost.toFixed(2)} €</p>
          </div>
          <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Indemnités</span>
            <p className="text-lg font-bold text-amber-600">{data.totalIndemnity.toFixed(2)} €</p>
          </div>
        </div>

        {data.missingPricingCount > 0 && (
          <div className="rounded-md bg-amber-50 p-3 border border-amber-100 flex gap-2">
            <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-800">Action requise</p>
              <p className="text-[11px] text-amber-700 leading-tight">
                {data.missingPricingCount} expédition(s) sans tarif.
              </p>
            </div>
          </div>
        )}

        {data.status === 'pending' && data.missingPricingCount === 0 && (
          <div className="rounded-md bg-green-50 p-3 border border-green-100 flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-xs font-medium">Prêt pour facturation</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2 pt-0 pb-4">
        {data.missingPricingCount > 0 ? (
          <Button variant="outline" size="sm" className="w-full text-amber-700 border-amber-200 hover:bg-amber-50 h-8 text-xs">
            Compléter
          </Button>
        ) : (
          <>
            <Button className="flex-1 h-8 text-xs" variant="default" size="sm">
              <FileText className="mr-2 h-3 w-3" />
              Générer
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Download className="h-3 w-3" />
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
