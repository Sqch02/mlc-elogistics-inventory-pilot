'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, DollarSign, Truck, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { usePricing, PricingRule } from '@/hooks/usePricing'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'

function formatWeight(grams: number) {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`
  }
  return `${grams} g`
}

export function PricingClient() {
  const [isExporting, setIsExporting] = useState(false)

  const { data, isLoading, isFetching } = usePricing()

  const rules = data?.rules || []
  const stats = data?.stats || {
    totalRules: 0,
    carriers: [],
    missingPricingCount: 0,
  }

  // Group by carrier
  const carrierGroups = rules.reduce((acc, rule) => {
    if (!acc[rule.carrier]) {
      acc[rule.carrier] = []
    }
    acc[rule.carrier].push(rule)
    return acc
  }, {} as Record<string, PricingRule[]>)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportData = rules.map(r => ({
        transporteur: r.carrier,
        poids_min_g: r.weight_min_grams,
        poids_max_g: r.weight_max_grams,
        prix_eur: r.price_eur,
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `grille_tarifaire_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return <PricingLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Grille Tarifaire</h1>
          <p className="text-muted-foreground text-sm">
            {rules.length} regle(s) {isFetching && '(chargement...)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Regles</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.totalRules}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <DollarSign className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Transporteurs</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.carriers.length}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <Truck className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className={`shadow-sm border-border col-span-2 lg:col-span-1 ${stats.missingPricingCount > 0 ? 'border-amber-300' : ''}`}>
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Tarifs manquants</p>
              <p className={`text-lg lg:text-2xl font-bold ${stats.missingPricingCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {stats.missingPricingCount}
              </p>
            </div>
            <div className={`p-1.5 lg:p-2 rounded-lg ${stats.missingPricingCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
              {stats.missingPricingCount > 0 ? (
                <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5" />
              ) : (
                <CheckCircle className="h-4 w-4 lg:h-5 lg:w-5" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucune regle tarifaire configuree</p>
            <p className="text-xs mt-1">Importez une grille via Parametres &gt; Import</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 whitespace-nowrap">Transporteur</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Min</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Max</TableHead>
                  <TableHead className="text-right pr-4 lg:pr-6 whitespace-nowrap">Prix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule, index) => {
                  const isFirstOfCarrier = index === 0 || rules[index - 1].carrier !== rule.carrier
                  return (
                    <TableRow key={rule.id} className="group">
                      <TableCell className="pl-4 lg:pl-6">
                        {isFirstOfCarrier ? (
                          <Badge variant="default" className="font-medium text-xs">
                            {rule.carrier}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm ml-2">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs lg:text-sm whitespace-nowrap">
                        {formatWeight(rule.weight_min_grams)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs lg:text-sm whitespace-nowrap">
                        {formatWeight(rule.weight_max_grams)}
                      </TableCell>
                      <TableCell className="text-right font-medium pr-4 lg:pr-6 whitespace-nowrap">
                        {rule.price_eur.toFixed(2)} EUR
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}

function PricingLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
