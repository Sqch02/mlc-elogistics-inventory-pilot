'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Download, MapPin, Package, CheckCircle, XCircle, Loader2, Search, X, Plus, MoreHorizontal, Pencil, Trash2, Link2, Unlink, Table as TableIcon, LayoutGrid, Upload } from 'lucide-react'
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation, Location } from '@/hooks/useLocations'
import { useSkus } from '@/hooks/useSkus'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { WarehouseVisualMap } from '@/components/warehouse/WarehouseVisualMap'
import { EditLocationDialog } from '@/components/warehouse/EditLocationDialog'
import { ImportPreviewDialog } from '@/components/forms/ImportPreviewDialog'
import { features } from '@/lib/config/features'

export function EmplacementsClient() {
  const [isExporting, setIsExporting] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'occupied' | 'empty'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'visual'>('table')

  // CRUD Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [quickEditOpen, setQuickEditOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Form states
  const [formCode, setFormCode] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [formSkuCode, setFormSkuCode] = useState('')

  const { data, isLoading, isFetching, refetch } = useLocations()
  const { data: skusData } = useSkus()

  const createMutation = useCreateLocation()
  const updateMutation = useUpdateLocation()
  const deleteMutation = useDeleteLocation()

  const allLocations = data?.locations || []
  const stats = data?.stats || {
    total: 0,
    occupied: 0,
    empty: 0,
    active: 0,
    occupancyRate: 0,
  }
  const skus = skusData?.skus || []

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
        quantite: l.assignment?.sku?.stock_snapshots?.[0]?.qty_current ?? '-',
        date_assignation: l.assignment?.assigned_at
          ? new Date(l.assignment.assigned_at).toLocaleDateString('fr-FR')
          : '-',
        actif: l.active ? 'Oui' : 'Non',
        statut: l.assignment ? 'Occupe' : 'Libre',
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `emplacements_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  // Open create dialog
  const openCreate = () => {
    setFormCode('')
    setFormLabel('')
    setFormActive(true)
    setCreateOpen(true)
  }

  // Open edit dialog
  const openEdit = (location: Location) => {
    setSelectedLocation(location)
    setFormCode(location.code)
    setFormLabel(location.label || '')
    setFormActive(location.active)
    setEditOpen(true)
  }

  // Open delete dialog
  const openDelete = (location: Location) => {
    setSelectedLocation(location)
    setDeleteOpen(true)
  }

  // Open assign dialog
  const openAssign = (location: Location) => {
    setSelectedLocation(location)
    setFormSkuCode(location.assignment?.sku?.sku_code || '')
    setAssignOpen(true)
  }

  // Handle unassign
  const handleUnassign = async (location: Location) => {
    try {
      await updateMutation.mutateAsync({
        id: location.id,
        sku_code: null,
      })
      toast.success('SKU desassigne')
    } catch {
      // Error handled by mutation
    }
  }

  // Handle create submit
  const handleCreate = async () => {
    if (!formCode.trim()) {
      toast.error('Le code est requis')
      return
    }

    try {
      await createMutation.mutateAsync({
        code: formCode.trim(),
        label: formLabel.trim() || undefined,
        active: formActive,
      })
      setCreateOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle edit submit
  const handleEdit = async () => {
    if (!selectedLocation || !formCode.trim()) return

    try {
      await updateMutation.mutateAsync({
        id: selectedLocation.id,
        code: formCode.trim(),
        label: formLabel.trim() || undefined,
        active: formActive,
      })
      setEditOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle assign submit
  const handleAssign = async () => {
    if (!selectedLocation) return

    try {
      await updateMutation.mutateAsync({
        id: selectedLocation.id,
        sku_code: formSkuCode || null,
      })
      toast.success(formSkuCode ? 'SKU assigne' : 'SKU desassigne')
      setAssignOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle delete submit
  const handleDelete = async () => {
    if (!selectedLocation) return

    try {
      await deleteMutation.mutateAsync(selectedLocation.id)
      setDeleteOpen(false)
    } catch {
      // Error handled by mutation
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
          {/* View toggle - Only show if warehouse map feature is enabled */}
          {features.warehouseMap && (
            <div className="flex items-center border rounded-lg p-0.5 bg-muted/50">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-7 px-2"
              >
                <TableIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Tableau</span>
              </Button>
              <Button
                variant={viewMode === 'visual' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('visual')}
                className="h-7 px-2"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Carte</span>
              </Button>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importer
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel emplacement
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
            <SelectItem value="occupied">Occupes</SelectItem>
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
            {locations.length} resultat(s)
          </span>
        )}
      </div>

      {/* Content: Table or Visual Map (only if feature enabled) */}
      {features.warehouseMap && viewMode === 'visual' ? (
        <WarehouseVisualMap
          onLocationClick={(location) => {
            setSelectedLocation(location)
            setQuickEditOpen(true)
          }}
          onCreateLocation={async (code) => {
            try {
              const newLocation = await createMutation.mutateAsync({
                code,
                active: true,
              })
              // Open edit dialog for the new location
              if (newLocation) {
                setSelectedLocation(newLocation as Location)
                setQuickEditOpen(true)
              }
              toast.success(`Emplacement ${code} créé`)
            } catch {
              // Error handled by mutation
            }
          }}
        />
      ) : (
      <Card className="shadow-sm border-border">
        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MapPin className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucun emplacement configure</p>
            <Button variant="link" size="sm" className="mt-2" onClick={openCreate}>
              Creer un emplacement
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 whitespace-nowrap">Code</TableHead>
                  <TableHead className="hidden sm:table-cell">Label</TableHead>
                  <TableHead className="whitespace-nowrap">SKU</TableHead>
                  <TableHead className="text-center whitespace-nowrap hidden md:table-cell">Qte</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">Assigne le</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Actif</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Statut</TableHead>
                  <TableHead className="w-[60px] pr-4 lg:pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => {
                  const stockQty = location.assignment?.sku?.stock_snapshots?.[0]?.qty_current
                  return (
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
                    <TableCell className="text-center hidden md:table-cell">
                      {stockQty !== undefined ? (
                        <span className={`font-medium ${stockQty < 20 ? 'text-red-600' : stockQty < 50 ? 'text-amber-600' : 'text-green-600'}`}>
                          {stockQty}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {location.assignment?.assigned_at
                        ? new Date(location.assignment.assigned_at).toLocaleDateString('fr-FR')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {location.active ? (
                        <CheckCircle className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={location.assignment ? 'success' : 'muted'} className="text-xs">
                        {location.assignment ? 'Occupe' : 'Libre'}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4 lg:pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openAssign(location)}>
                            <Link2 className="mr-2 h-4 w-4" />
                            Assigner SKU
                          </DropdownMenuItem>
                          {location.assignment && (
                            <DropdownMenuItem onClick={() => handleUnassign(location)}>
                              <Unlink className="mr-2 h-4 w-4" />
                              Desassigner
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(location)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-error" onClick={() => openDelete(location)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      )}

      {/* Quick Edit Dialog for Visual Map */}
      <EditLocationDialog
        location={selectedLocation}
        open={quickEditOpen}
        onOpenChange={setQuickEditOpen}
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel emplacement</DialogTitle>
            <DialogDescription>
              Creez un nouvel emplacement dans votre entrepot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Code *</label>
              <Input
                placeholder="ex: A-01-001"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <Input
                placeholder="Description optionnelle"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="formActive"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="formActive" className="text-sm">Emplacement actif</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Creer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;emplacement</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l&apos;emplacement {selectedLocation?.code}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Code *</label>
              <Input
                placeholder="ex: A-01-001"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <Input
                placeholder="Description optionnelle"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editActive"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="editActive" className="text-sm">Emplacement actif</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner un SKU</DialogTitle>
            <DialogDescription>
              Assignez un produit a l&apos;emplacement {selectedLocation?.code}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">SKU</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={formSkuCode}
                onChange={(e) => setFormSkuCode(e.target.value)}
              >
                <option value="">Aucun (liberer l&apos;emplacement)</option>
                {skus.map((sku) => (
                  <option key={sku.id} value={sku.sku_code}>
                    {sku.sku_code} - {sku.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAssign} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;emplacement</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer l&apos;emplacement {selectedLocation?.code} ?
              Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ImportPreviewDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        importType="locations"
        importEndpoint="/api/import/locations"
        title="Importer des emplacements"
        description="Colonnes: code, label (optionnel), sku_code (optionnel)"
        keyField="code"
        onSuccess={() => refetch()}
      />
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
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-40" />
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
