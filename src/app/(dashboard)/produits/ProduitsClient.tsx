'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Package, TrendingDown, AlertTriangle, Warehouse, Search, X, Download, Loader2, Plus, MoreHorizontal, Pencil, Trash2, PackagePlus, History, ArrowUpRight, ArrowDownRight, Clock, Upload, BarChart3 } from 'lucide-react'
import { useProducts, ProductFilters } from '@/hooks/useProducts'
import { useSkus, useCreateSku, useUpdateSku, useDeleteSku, useAdjustStock, useSkuMovements, SKU, StockMovement } from '@/hooks/useSkus'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'
import { ImportPreviewDialog } from '@/components/forms/ImportPreviewDialog'

function getStatusBadge(status: string) {
  switch (status) {
    case 'ok':
      return <Badge variant="success">En stock</Badge>
    case 'warning':
      return <Badge variant="warning">Faible</Badge>
    case 'critical':
      return <Badge variant="error">Critique</Badge>
    case 'rupture':
      return <Badge variant="error">Rupture</Badge>
    default:
      return <Badge variant="muted">{status}</Badge>
  }
}

function getMovementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    manual: 'Manuel',
    shipment: 'Expedition',
    restock: 'Reappro',
    correction: 'Correction',
    import: 'Import',
  }
  return labels[type] || type
}

function formatMovementDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface ProductFormData {
  sku_code: string
  name: string
  alert_threshold: number
  qty_initial: number
}

interface MonthlyVolumeData {
  sku: { id: string; sku_code: string; name: string }
  months: { month: string; label: string; volume: number }[]
  totalVolume: number
  avgVolume: number
}

const defaultFormData: ProductFormData = {
  sku_code: '',
  name: '',
  alert_threshold: 10,
  qty_initial: 0,
}

export function ProduitsClient() {
  const [filters, setFilters] = useState<ProductFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySkuId, setHistorySkuId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [volumeData, setVolumeData] = useState<MonthlyVolumeData | null>(null)
  const [volumeLoading, setVolumeLoading] = useState(false)
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData)
  const [stockAdjustment, setStockAdjustment] = useState({ qty: 0, reason: '' })

  const { data, isLoading, isFetching, refetch } = useProducts(filters)
  const { data: skusData } = useSkus()
  const { data: movementsData, isLoading: movementsLoading } = useSkuMovements(historySkuId)
  const createMutation = useCreateSku()
  const updateMutation = useUpdateSku()
  const deleteMutation = useDeleteSku()
  const adjustStockMutation = useAdjustStock()

  const skus = data?.skus || []
  const stats = data?.stats || { totalSkus: 0, totalStock: 0, totalConsumption30d: 0, criticalCount: 0 }

  // Find full SKU data for editing
  const getFullSku = (skuCode: string) => {
    return skusData?.skus?.find(s => s.sku_code === skuCode)
  }

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
        stock_actuel: s.qty_current || 0,
        seuil_alerte: s.alert_threshold || 0,
        consommation_30j: s.consumption_30d || 0,
        moyenne_90j: s.avg_daily_90d || 0,
        jours_restants: s.days_remaining ?? 'N/A',
        statut: s.status || ''
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `produits_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  // Create
  const handleCreate = async () => {
    await createMutation.mutateAsync({
      sku_code: formData.sku_code,
      name: formData.name,
      alert_threshold: formData.alert_threshold,
      qty_initial: formData.qty_initial,
    })
    setCreateOpen(false)
    setFormData(defaultFormData)
  }

  // Edit
  const openEdit = (skuCode: string) => {
    const sku = getFullSku(skuCode)
    if (sku) {
      setSelectedSku(sku)
      setFormData({
        sku_code: sku.sku_code,
        name: sku.name,
        alert_threshold: sku.alert_threshold,
        qty_initial: sku.qty_current,
      })
      setEditOpen(true)
    }
  }

  const handleEdit = async () => {
    if (!selectedSku) return
    await updateMutation.mutateAsync({
      id: selectedSku.id,
      sku_code: formData.sku_code,
      name: formData.name,
      alert_threshold: formData.alert_threshold,
    })
    setEditOpen(false)
    setSelectedSku(null)
  }

  // Delete
  const openDelete = (skuCode: string) => {
    const sku = getFullSku(skuCode)
    if (sku) {
      setSelectedSku(sku)
      setDeleteOpen(true)
    }
  }

  const handleDelete = async () => {
    if (!selectedSku) return
    await deleteMutation.mutateAsync(selectedSku.id)
    setDeleteOpen(false)
    setSelectedSku(null)
  }

  // Stock adjustment
  const openStockAdjust = (skuCode: string) => {
    const sku = getFullSku(skuCode)
    if (sku) {
      setSelectedSku(sku)
      setStockAdjustment({ qty: 0, reason: '' })
      setStockOpen(true)
    }
  }

  const handleStockAdjust = async () => {
    if (!selectedSku) return
    await adjustStockMutation.mutateAsync({
      id: selectedSku.id,
      adjustment: stockAdjustment.qty,
      reason: stockAdjustment.reason || undefined,
    })
    setStockOpen(false)
    setSelectedSku(null)
  }

  // History
  const openHistory = (skuCode: string) => {
    const sku = getFullSku(skuCode)
    if (sku) {
      setHistorySkuId(sku.id)
      setSelectedSku(sku)
      setHistoryOpen(true)
    }
  }

  const closeHistory = () => {
    setHistoryOpen(false)
    setHistorySkuId(null)
    setSelectedSku(null)
  }

  // Volume mensuel
  const openVolume = async (skuCode: string) => {
    const sku = getFullSku(skuCode)
    if (sku) {
      setSelectedSku(sku)
      setVolumeOpen(true)
      setVolumeLoading(true)
      try {
        const res = await fetch(`/api/skus/${sku.id}/monthly-volume`)
        if (res.ok) {
          const data = await res.json()
          setVolumeData(data)
        }
      } catch (error) {
        console.error('Error fetching volume:', error)
      } finally {
        setVolumeLoading(false)
      }
    }
  }

  const closeVolume = () => {
    setVolumeOpen(false)
    setVolumeData(null)
    setSelectedSku(null)
  }

  const hasFilters = Object.keys(filters).length > 0
  const isSubmitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || adjustStockMutation.isPending

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer
          </Button>
          <Button onClick={() => { setFormData(defaultFormData); setCreateOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
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
        <Card>
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
        <Card>
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
        <Card className={stats.criticalCount > 0 ? 'border-error/50' : ''}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase">Critiques</p>
              <p className={`text-2xl font-bold ${stats.criticalCount > 0 ? 'text-error' : 'text-success'}`}>
                {stats.criticalCount}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${stats.criticalCount > 0 ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
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
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
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

          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Export</span>
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {skus.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucun produit trouve</p>
            <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Creer un produit
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">SKU</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right hidden md:table-cell">Conso 30j</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Jours</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skus.map((sku) => (
                <TableRow key={sku.sku_code}>
                  <TableCell className="font-mono font-medium pl-6">{sku.sku_code}</TableCell>
                  <TableCell>
                    <span className="font-medium">{sku.name}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{sku.qty_current}</TableCell>
                  <TableCell className="text-right font-mono hidden md:table-cell">{sku.consumption_30d}</TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    {sku.days_remaining !== null ? (
                      <span className={`font-mono ${sku.days_remaining < 7 ? 'text-error font-semibold' : sku.days_remaining < 14 ? 'text-warning' : ''}`}>
                        {sku.days_remaining}j
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(sku.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openStockAdjust(sku.sku_code)}>
                          <PackagePlus className="h-4 w-4 mr-2" />
                          Ajuster stock
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openHistory(sku.sku_code)}>
                          <History className="h-4 w-4 mr-2" />
                          Historique
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openVolume(sku.sku_code)}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Volume mensuel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(sku.sku_code)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-error" onClick={() => openDelete(sku.sku_code)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau produit</DialogTitle>
            <DialogDescription>Creer un nouveau SKU dans l&apos;inventaire</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku_code">Code SKU *</Label>
                <Input
                  id="sku_code"
                  placeholder="ABC-123"
                  value={formData.sku_code}
                  onChange={(e) => setFormData({ ...formData, sku_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  placeholder="Nom du produit"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qty_initial">Stock initial</Label>
                <Input
                  id="qty_initial"
                  type="number"
                  min="0"
                  value={formData.qty_initial}
                  onChange={(e) => setFormData({ ...formData, qty_initial: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert_threshold">Seuil d&apos;alerte</Label>
                <Input
                  id="alert_threshold"
                  type="number"
                  min="0"
                  value={formData.alert_threshold}
                  onChange={(e) => setFormData({ ...formData, alert_threshold: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={isSubmitting || !formData.sku_code || !formData.name}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Creer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le produit</DialogTitle>
            <DialogDescription>Modifier les informations du SKU</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_sku_code">Code SKU</Label>
                <Input
                  id="edit_sku_code"
                  value={formData.sku_code}
                  onChange={(e) => setFormData({ ...formData, sku_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_name">Nom</Label>
                <Input
                  id="edit_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_alert_threshold">Seuil d&apos;alerte</Label>
              <Input
                id="edit_alert_threshold"
                type="number"
                min="0"
                value={formData.alert_threshold}
                onChange={(e) => setFormData({ ...formData, alert_threshold: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le produit</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer <strong>{selectedSku?.sku_code}</strong> ?
              Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuster le stock</DialogTitle>
            <DialogDescription>
              Stock actuel de <strong>{selectedSku?.sku_code}</strong>: {selectedSku?.qty_current} unites
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stock_qty">Ajustement (+/-)</Label>
              <Input
                id="stock_qty"
                type="number"
                placeholder="+10 ou -5"
                value={stockAdjustment.qty || ''}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, qty: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Nouveau stock: {(selectedSku?.qty_current || 0) + stockAdjustment.qty}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock_reason">Raison (optionnel)</Label>
              <Input
                id="stock_reason"
                placeholder="Reception, inventaire, casse..."
                value={stockAdjustment.reason}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>Annuler</Button>
            <Button onClick={handleStockAdjust} disabled={isSubmitting || stockAdjustment.qty === 0}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock History Dialog */}
      <Dialog open={historyOpen} onOpenChange={(open) => !open && closeHistory()}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique du stock
            </DialogTitle>
            <DialogDescription>
              Mouvements de stock pour <strong>{selectedSku?.sku_code}</strong> - {selectedSku?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[50vh] overflow-y-auto">
            {movementsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !movementsData?.movements?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Aucun mouvement enregistre</p>
              </div>
            ) : (
              <div className="space-y-3">
                {movementsData.movements.map((movement: StockMovement) => (
                  <div key={movement.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className={`p-2 rounded-full ${movement.adjustment >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                      {movement.adjustment >= 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono font-semibold ${movement.adjustment >= 0 ? 'text-success' : 'text-error'}`}>
                          {movement.adjustment >= 0 ? '+' : ''}{movement.adjustment}
                        </span>
                        <span className="text-muted-foreground">
                          {movement.qty_before} → {movement.qty_after}
                        </span>
                        <Badge variant="muted" className="text-xs">
                          {getMovementTypeLabel(movement.movement_type)}
                        </Badge>
                      </div>
                      {movement.reason && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{movement.reason}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatMovementDate(movement.created_at)}</span>
                        <span>•</span>
                        <span>{movement.user.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeHistory}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ImportPreviewDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        importType="skus"
        importEndpoint="/api/import/skus"
        title="Importer des produits"
        description="Importez vos SKUs depuis un fichier CSV ou Excel. Les produits existants seront mis à jour."
        keyField="sku_code"
        onSuccess={() => refetch()}
      />

      {/* Volume Mensuel Dialog */}
      <Dialog open={volumeOpen} onOpenChange={(open) => !open && closeVolume()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Volume mensuel
            </DialogTitle>
            <DialogDescription>
              Ventes des 12 derniers mois pour <strong>{selectedSku?.sku_code}</strong> - {selectedSku?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {volumeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : volumeData ? (
              <div className="space-y-4">
                {/* Bar chart visualization */}
                <div className="grid grid-cols-12 gap-1 items-end h-32 px-2">
                  {volumeData.months.map((m) => {
                    const maxVolume = Math.max(...volumeData.months.map(x => x.volume), 1)
                    const height = (m.volume / maxVolume) * 100
                    return (
                      <div key={m.month} className="flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${m.label}: ${m.volume}`}
                        />
                        <span className="text-[10px] text-muted-foreground font-medium">{m.label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Table with values */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Mois</th>
                        <th className="px-3 py-2 text-right font-medium">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {volumeData.months.map((m, i) => (
                        <tr key={m.month} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                          <td className="px-3 py-1.5">{m.label} {m.month.split('-')[0]}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{m.volume.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50 font-medium">
                      <tr>
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right font-mono">{volumeData.totalVolume.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Moyenne / mois</td>
                        <td className="px-3 py-2 text-right font-mono">{volumeData.avgVolume.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeVolume}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        <Skeleton className="h-9 w-36" />
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
        <div className="flex gap-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
      </Card>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
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
