'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, Boxes, Package, Loader2 } from 'lucide-react'
import { useBundles, Bundle } from '@/hooks/useBundles'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'

export function BundlesClient() {
  const [isExporting, setIsExporting] = useState(false)

  const { data, isLoading, isFetching } = useBundles()

  const bundles = data?.bundles || []

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportData = bundles.map(b => ({
        bundle_sku: b.bundle_sku?.sku_code || '-',
        bundle_nom: b.bundle_sku?.name || '-',
        nb_composants: b.components.length,
        composants: b.components.map(c => `${c.qty_component}x ${c.component_sku?.sku_code || '?'}`).join(', '),
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `bundles_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return <BundlesLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bundles (BOM)</h1>
          <p className="text-muted-foreground text-sm">
            {bundles.length} bundle(s) configure(s) {isFetching && '(chargement...)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        {bundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Boxes className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucun bundle configure</p>
            <p className="text-xs mt-1">Importez des bundles via Parametres &gt; Import</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Bundle SKU</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Composants</TableHead>
                <TableHead className="text-right pr-6">Nb composants</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((bundle) => (
                <TableRow key={bundle.id} className="group">
                  <TableCell className="font-mono font-medium pl-6">
                    {bundle.bundle_sku?.sku_code || '-'}
                  </TableCell>
                  <TableCell>{bundle.bundle_sku?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {bundle.components.slice(0, 4).map((comp, i) => (
                        <Badge key={i} variant="muted" className="text-xs">
                          {comp.qty_component}x {comp.component_sku?.sku_code || '?'}
                        </Badge>
                      ))}
                      {bundle.components.length > 4 && (
                        <Badge variant="muted" className="text-xs">
                          +{bundle.components.length - 4}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>{bundle.components.length}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function BundlesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
