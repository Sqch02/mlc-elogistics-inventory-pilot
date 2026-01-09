'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, MapPin, Package, CheckCircle, XCircle, Loader2, Search, X } from 'lucide-react'
import { useLocations, Location } from '@/hooks/useLocations'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function EmplacementsClient() {
  const [isExporting, setIsExporting] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'occupied' | 'empty'>('all')

  const { data, isLoading, isFetching } = useLocations()

  const allLocations = data?.locations || []
  const stats = data?.stats || {
    total: 0,
    occupied: 0,
    empty: 0,
    active: 0,
    occupancyRate: 0,
  }

  // Filter locations based on search and status
  const locations = useMemo(() => {
    let filtered = allLocations

    // Filter by search (code, label, or SKU)
    if (searchInput.trim()) {
      const search = searchInput.toLowerCase()
      filtered = filtered.filter((loc) =>
        loc.code.toLowerCase().includes(search) ||
        loc.label?.toLowerCase().includes(search) ||
        loc.assignment?.sku?.sku_code.toLowerCase().includes(search) ||
        loc.assignment?.sku?.name.toLowerCase().includes(search)
      )
    }

    // Filter by status
    if (statusFilter === 'occupied') {
      filtered = filtered.filter((loc) => loc.assignment !== null)
    } else if (statusFilter === 'empty') {
      filtered = filtered.filter((loc) => loc.assignment === null)
    }

    return filtered
  }, [allLocations, searchInput, statusFilter])

  const clearFilters = () => {
    setSearchInput('')
    setStatusFilter('all')
  }

  const hasFilters = searchInput.trim() !== '' || statusFilter !== 'all'

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportData = locations.map(l => ({
        code: l.code,
        label: l.label || '-',
        sku_assigne: l.assignment?.sku?.sku_code || '-',
        sku_nom: l.assignment?.sku?.name || '-',
        actif: l.active ? 'Oui' : 'Non',
        statut: l.assignment ? 'Occupe' : 'Libre',
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `emplacements_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return <EmplacementsLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Emplacements</h1>
          <p className="text-muted-foreground text-sm">
            {stats.total} emplacement(s) {isFetching && '(chargement...)'}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Total</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <MapPin className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Occupes</p>
              <p className="text-lg lg:text-2xl font-bold text-green-600">{stats.occupied}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-green-100 rounded-lg text-green-600">
              <Package className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Libres</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.empty}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-gray-100 rounded-lg text-gray-600">
              <MapPin className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Occupation</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.occupancyRate}%</p>
            </div>
            <div className="w-12 lg:w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${stats.occupancyRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-border shadow-sm">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (emplacement ou SKU)..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | 'occupied' | 'empty')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="occupied">Occupés</SelectItem>
            <SelectItem value="empty">Libres</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Effacer
          </Button>
        )}

        {hasFilters && (
          <span className="text-sm text-muted-foreground">
            {locations.length} résultat(s)
          </span>
        )}
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MapPin className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucun emplacement configure</p>
            <p className="text-xs mt-1">Importez des emplacements via Parametres &gt; Import</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 whitespace-nowrap">Code</TableHead>
                  <TableHead className="hidden sm:table-cell">Label</TableHead>
                  <TableHead className="whitespace-nowrap">SKU</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Actif</TableHead>
                  <TableHead className="text-right pr-4 lg:pr-6 whitespace-nowrap">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id} className="group">
                    <TableCell className="font-mono font-medium pl-4 lg:pl-6 text-xs lg:text-sm">{location.code}</TableCell>
                    <TableCell className="hidden sm:table-cell">{location.label || '-'}</TableCell>
                    <TableCell>
                      {location.assignment?.sku ? (
                        <div>
                          <span className="font-mono text-xs lg:text-sm">{location.assignment.sku.sku_code}</span>
                          <span className="text-muted-foreground text-xs ml-1 hidden lg:inline">
                            {location.assignment.sku.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {location.active ? (
                        <CheckCircle className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4 lg:pr-6">
                      <Badge variant={location.assignment ? 'success' : 'muted'} className="text-xs">
                        {location.assignment ? 'Occupe' : 'Libre'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}

function EmplacementsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
