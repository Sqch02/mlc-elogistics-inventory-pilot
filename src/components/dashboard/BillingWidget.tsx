"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BillingSummary } from "@/types/dashboard"
import { FileText, Download, CheckCircle2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface BillingWidgetProps {
  data: BillingSummary
  month: string
}

export function BillingWidget({ data, month }: BillingWidgetProps) {
  const monthName = new Date(month).toLocaleDateString('fr-FR', { month: 'long' })

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold capitalize">{monthName}</CardTitle>
        <Badge variant={
          data.status === 'generated' ? 'success' :
          data.status === 'exported' ? 'gold' : 'muted'
        }>
          {data.status === 'pending' ? 'En attente' : data.status === 'generated' ? 'Genere' : 'Exporte'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 p-3 bg-primary/5 rounded-lg border border-primary/10">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">Transport</span>
            <p className="text-lg font-bold text-foreground">{data.totalCost.toFixed(2)} €</p>
          </div>
          <div className="space-y-1 p-3 bg-warning/5 rounded-lg border border-warning/10">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">Indemnites</span>
            <p className="text-lg font-bold text-warning">{data.totalIndemnity.toFixed(2)} €</p>
          </div>
        </div>

        {data.missingPricingCount > 0 && (
          <div className="rounded-lg bg-warning/5 p-3 border border-warning/20 flex gap-3">
            <div className="p-1.5 rounded-md bg-warning/10">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">Action requise</p>
              <p className="text-[11px] text-muted-foreground">
                {data.missingPricingCount} expedition(s) sans tarif
              </p>
            </div>
          </div>
        )}

        {data.status === 'pending' && data.missingPricingCount === 0 && (
          <div className="rounded-lg bg-success/5 p-3 border border-success/20 flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <p className="text-xs font-medium text-foreground">Pret pour facturation</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2 pt-0 pb-5">
        {data.missingPricingCount > 0 ? (
          <Button variant="warning" size="sm" className="w-full h-9 text-xs">
            Completer les tarifs
          </Button>
        ) : (
          <>
            <Button className="flex-1 h-9 text-xs" variant="default" size="sm">
              <FileText className="mr-2 h-3.5 w-3.5" />
              Generer facture
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Download className="h-4 w-4" />
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
