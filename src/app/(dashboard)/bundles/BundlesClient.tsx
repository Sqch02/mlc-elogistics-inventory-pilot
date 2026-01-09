'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Download, Boxes, Package, Loader2, Plus, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { useBundles, useCreateBundle, useUpdateBundle, useDeleteBundle, Bundle } from '@/hooks/useBundles'
import { useSkus } from '@/hooks/useSkus'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface ComponentInput {
  sku_code: string
  qty: number
}

export function BundlesClient() {
  const [isExporting, setIsExporting] = useState(false)

  // CRUD Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null)

  // Form states
  const [bundleSkuCode, setBundleSkuCode] = useState('')
  const [components, setComponents] = useState<ComponentInput[]>([{ sku_code: '', qty: 1 }])

  const { data, isLoading, isFetching } = useBundles()
  const { data: skusData } = useSkus()

  const createMutation = useCreateBundle()
  const updateMutation = useUpdateBundle()
  const deleteMutation = useDeleteBundle()

  const bundles = data?.bundles || []
  const skus = skusData?.skus || []

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

  // Open create dialog
  const openCreate = () => {
    setBundleSkuCode('')
    setComponents([{ sku_code: '', qty: 1 }])
    setCreateOpen(true)
  }

  // Open edit dialog
  const openEdit = (bundle: Bundle) => {
    setSelectedBundle(bundle)
    setComponents(
      bundle.components.map(c => ({
        sku_code: c.component_sku?.sku_code || '',
        qty: c.qty_component,
      }))
    )
    setEditOpen(true)
  }

  // Open delete dialog
  const openDelete = (bundle: Bundle) => {
    setSelectedBundle(bundle)
    setDeleteOpen(true)
  }

  // Add component input
  const addComponent = () => {
    setComponents([...components, { sku_code: '', qty: 1 }])
  }

  // Remove component input
  const removeComponent = (index: number) => {
    if (components.length > 1) {
      setComponents(components.filter((_, i) => i !== index))
    }
  }

  // Update component
  const updateComponent = (index: number, field: 'sku_code' | 'qty', value: string | number) => {
    const updated = [...components]
    updated[index] = { ...updated[index], [field]: value }
    setComponents(updated)
  }

  // Handle create submit
  const handleCreate = async () => {
    if (!bundleSkuCode.trim()) {
      toast.error('Le code SKU du bundle est requis')
      return
    }

    const validComponents = components.filter(c => c.sku_code.trim())
    if (validComponents.length === 0) {
      toast.error('Au moins un composant est requis')
      return
    }

    try {
      await createMutation.mutateAsync({
        bundle_sku_code: bundleSkuCode.trim(),
        components: validComponents.map(c => ({ sku_code: c.sku_code.trim(), qty: c.qty })),
      })
      toast.success('Bundle cree avec succes')
      setCreateOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle edit submit
  const handleEdit = async () => {
    if (!selectedBundle) return

    const validComponents = components.filter(c => c.sku_code.trim())
    if (validComponents.length === 0) {
      toast.error('Au moins un composant est requis')
      return
    }

    try {
      await updateMutation.mutateAsync({
        id: selectedBundle.id,
        components: validComponents.map(c => ({ sku_code: c.sku_code.trim(), qty: c.qty })),
      })
      toast.success('Bundle mis a jour')
      setEditOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle delete submit
  const handleDelete = async () => {
    if (!selectedBundle) return

    try {
      await deleteMutation.mutateAsync(selectedBundle.id)
      toast.success('Bundle supprime')
      setDeleteOpen(false)
    } catch {
      // Error handled by mutation
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
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau bundle
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        {bundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Boxes className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucun bundle configure</p>
            <Button variant="link" size="sm" className="mt-2" onClick={openCreate}>
              Creer un bundle
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Bundle SKU</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Composants</TableHead>
                <TableHead className="text-right">Nb composants</TableHead>
                <TableHead className="w-[60px] pr-6"></TableHead>
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
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>{bundle.components.length}</span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(bundle)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-error" onClick={() => openDelete(bundle)}>
                          <Trash2 className="mr-2 h-4 w-4" />
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nouveau bundle</DialogTitle>
            <DialogDescription>
              Creez un nouveau bundle en definissant le SKU et ses composants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Code SKU du bundle</label>
              <Input
                placeholder="ex: BUNDLE-001"
                value={bundleSkuCode}
                onChange={(e) => setBundleSkuCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Composants</label>
              <div className="space-y-2">
                {components.map((comp, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <select
                      className="min-w-0 flex-1 h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={comp.sku_code}
                      onChange={(e) => updateComponent(index, 'sku_code', e.target.value)}
                    >
                      <option value="">Selectionner...</option>
                      {skus.map((sku) => (
                        <option key={sku.id} value={sku.sku_code}>
                          {sku.sku_code}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      className="w-14 shrink-0 px-2"
                      placeholder="Qte"
                      value={comp.qty}
                      onChange={(e) => updateComponent(index, 'qty', parseInt(e.target.value) || 1)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive"
                      onClick={() => removeComponent(index)}
                      disabled={components.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addComponent}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un composant
              </Button>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modifier le bundle</DialogTitle>
            <DialogDescription>
              Modifiez les composants du bundle {selectedBundle?.bundle_sku?.sku_code}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Composants</label>
              <div className="space-y-2">
                {components.map((comp, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      className="min-w-0 flex-1 h-9 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={comp.sku_code}
                      onChange={(e) => updateComponent(index, 'sku_code', e.target.value)}
                    >
                      <option value="">Selectionner...</option>
                      {skus.map((sku) => (
                        <option key={sku.id} value={sku.sku_code}>
                          {sku.sku_code}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      className="w-14 shrink-0"
                      placeholder="Qte"
                      value={comp.qty}
                      onChange={(e) => updateComponent(index, 'qty', parseInt(e.target.value) || 1)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:border-destructive"
                      onClick={() => removeComponent(index)}
                      disabled={components.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addComponent}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un composant
              </Button>
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

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le bundle</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer le bundle {selectedBundle?.bundle_sku?.sku_code} ?
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
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
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
