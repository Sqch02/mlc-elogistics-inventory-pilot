'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package, TrendingDown, AlertTriangle, Warehouse, Search, X, Download, Loader2 } from 'lucide-react'
import { useProducts, ProductFilters, Product } from '@/hooks/useProducts'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'

function getStatusBadge(status: string) {
  switch (status) {
    case 'ok':
      return <Badge variant="success">En stock</Badge>
    case 'warning':
      return <Badge variant="warning">Faible</Badge>
    case 'critical':
      return <Badge variant="destructive">Critique</Badge>
    case 'rupture':
      return <Badge variant="destructive">Rupture</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export function ProduitsClient() {
  const [filters, setFilters] = useState<ProductFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const { data, isLoading, isFetching } = useProducts(filters)

  const skus = data?.skus || []
  const stats = data?.stats || { totalSkus: 0, totalStock: 0, totalConsumption30d: 0, criticalCount: 0 }

  const updateFilter = (key: keyof ProductFilters, value: string | undefined) => {
    setFilters(prev => {
      const next = { ...prev }
      if (value) {
        next[key] = value
      } else {
        delete next[key]
      }
      return next
    })
  }

  const handleSearch = () => {
    updateFilter('search', searchInput || undefined)
  }

  const clearFilters = () => {
    setFilters({})
    setSearchInput('')
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportData = skus.map(s => ({
        sku_code: s.sku_code || '',
        nom: s.name || '',
        description: s.description || '',
        stock_actuel: s.qty_current || 0,
        seuil_alerte: s.alert_threshold || 0,
        consommation_30j: s.consumption_30d || 0,
        moyenne_90j: s.avg_daily_90d || 0,
        jours_restants: s.days_remaining ?? 'N/A',
        restock_en_attente: s.pending_restock || 0,
        stock_projete: s.projected_stock || 0,
        statut: s.status || ''
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `produits_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  const hasFilters = Object.keys(filters).length > 0

  if (isLoading) {
    return <ProduitsLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Produits & Stock</h1>
          <p className="text-muted-foreground text-sm">
            {stats.totalSkus} SKU(s) {isFetching && '(chargement...)'}
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase">Total SKUs</p>
              <p className="text-2xl font-bold">{stats.totalSkus}</p>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase">Stock total</p>
              <p className="text-2xl font-bold">{stats.totalStock.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Warehouse className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase">Conso 30j</p>
              <p className="text-2xl font-bold">{stats.totalConsumption30d.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className={`shadow-sm border-border ${stats.criticalCount > 0 ? 'border-red-300' : ''}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase">Critiques</p>
              <p className={`text-2xl font-bold ${stats.criticalCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.criticalCount}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${stats.criticalCount > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (SKU, nom)..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            onBlur={handleSearch}
          />
        </div>

        <Select
          value={filters.status || 'all'}
          onValueChange={(v) => updateFilter('status', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="ok">En stock</SelectItem>
            <SelectItem value="warning">Faible</SelectItem>
            <SelectItem value="critical">Critique</SelectItem>
            <SelectItem value="rupture">Rupture</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Effacer
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        {skus.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucun produit trouve</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">SKU</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right hidden md:table-cell">Conso 30j</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Moy. 90j</TableHead>
                <TableHead className="text-right">Jours restants</TableHead>
                <TableHead className="text-right pr-6">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skus.map((sku) => (
                <TableRow key={sku.sku_code} className="group">
                  <TableCell className="font-mono font-medium pl-6">{sku.sku_code}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{sku.name}</span>
                      {sku.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {sku.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{sku.qty_current}</TableCell>
                  <TableCell className="text-right font-mono hidden md:table-cell">{sku.consumption_30d}</TableCell>
                  <TableCell className="text-right font-mono hidden lg:table-cell">{sku.avg_daily_90d.toFixed(1)}/j</TableCell>
                  <TableCell className="text-right">
                    {sku.days_remaining !== null ? (
                      <span className={`font-mono ${sku.days_remaining < 7 ? 'text-red-600 font-semibold' : sku.days_remaining < 14 ? 'text-amber-600' : ''}`}>
                        {sku.days_remaining}j
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-6">{getStatusBadge(sku.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function ProduitsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="flex gap-4 p-4 bg-white rounded-2xl border">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
