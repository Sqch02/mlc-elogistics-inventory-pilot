'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Download, DollarSign, Truck, AlertTriangle, CheckCircle, Loader2, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { usePricing, useCreatePricingRule, useUpdatePricingRule, useDeletePricingRule, PricingRule } from '@/hooks/usePricing'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

function formatWeight(grams: number) {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`
  }
  return `${grams} g`
}

export function PricingClient() {
  const [isExporting, setIsExporting] = useState(false)

  // CRUD Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null)

  // Form states
  const [formCarrier, setFormCarrier] = useState('')
  const [formWeightMin, setFormWeightMin] = useState<number>(0)
  const [formWeightMax, setFormWeightMax] = useState<number>(0)
  const [formPrice, setFormPrice] = useState<number>(0)

  const { data, isLoading, isFetching } = usePricing()

  const createMutation = useCreatePricingRule()
  const updateMutation = useUpdatePricingRule()
  const deleteMutation = useDeletePricingRule()

  const rules = data?.rules || []
  const stats = data?.stats || {
    totalRules: 0,
    carriers: [],
    missingPricingCount: 0,
  }

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

  // Open create dialog
  const openCreate = () => {
    setFormCarrier('')
    setFormWeightMin(0)
    setFormWeightMax(1000)
    setFormPrice(0)
    setCreateOpen(true)
  }

  // Open edit dialog
  const openEdit = (rule: PricingRule) => {
    setSelectedRule(rule)
    setFormCarrier(rule.carrier)
    setFormWeightMin(rule.weight_min_grams)
    setFormWeightMax(rule.weight_max_grams)
    setFormPrice(rule.price_eur)
    setEditOpen(true)
  }

  // Open delete dialog
  const openDelete = (rule: PricingRule) => {
    setSelectedRule(rule)
    setDeleteOpen(true)
  }

  // Handle create submit
  const handleCreate = async () => {
    if (!formCarrier.trim()) {
      toast.error('Le transporteur est requis')
      return
    }
    if (formWeightMin >= formWeightMax) {
      toast.error('Le poids min doit etre inferieur au poids max')
      return
    }
    if (formPrice <= 0) {
      toast.error('Le prix doit etre superieur a 0')
      return
    }

    try {
      await createMutation.mutateAsync({
        carrier: formCarrier.trim().toUpperCase(),
        weight_min_grams: formWeightMin,
        weight_max_grams: formWeightMax,
        price_eur: formPrice,
      })
      setCreateOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle edit submit
  const handleEdit = async () => {
    if (!selectedRule) return
    if (!formCarrier.trim()) {
      toast.error('Le transporteur est requis')
      return
    }
    if (formWeightMin >= formWeightMax) {
      toast.error('Le poids min doit etre inferieur au poids max')
      return
    }
    if (formPrice <= 0) {
      toast.error('Le prix doit etre superieur a 0')
      return
    }

    try {
      await updateMutation.mutateAsync({
        id: selectedRule.id,
        carrier: formCarrier.trim().toUpperCase(),
        weight_min_grams: formWeightMin,
        weight_max_grams: formWeightMax,
        price_eur: formPrice,
      })
      setEditOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle delete submit
  const handleDelete = async () => {
    if (!selectedRule) return

    try {
      await deleteMutation.mutateAsync(selectedRule.id)
      setDeleteOpen(false)
    } catch {
      // Error handled by mutation
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
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle regle
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
            <Button variant="link" size="sm" className="mt-2" onClick={openCreate}>
              Creer une regle
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 whitespace-nowrap">Transporteur</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Min</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Max</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Prix</TableHead>
                  <TableHead className="w-[60px] pr-4 lg:pr-6"></TableHead>
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
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {rule.price_eur.toFixed(2)} EUR
                      </TableCell>
                      <TableCell className="pr-4 lg:pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(rule)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-error" onClick={() => openDelete(rule)}>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle regle tarifaire</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle tranche de poids pour un transporteur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transporteur *</label>
              <Input
                placeholder="ex: COLISSIMO"
                value={formCarrier}
                onChange={(e) => setFormCarrier(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Poids min (g) *</label>
                <Input
                  type="number"
                  min="0"
                  value={formWeightMin}
                  onChange={(e) => setFormWeightMin(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Poids max (g) *</label>
                <Input
                  type="number"
                  min="0"
                  value={formWeightMax}
                  onChange={(e) => setFormWeightMax(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prix (EUR) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
              />
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
            <DialogTitle>Modifier la regle</DialogTitle>
            <DialogDescription>
              Modifiez les parametres de cette tranche tarifaire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transporteur *</label>
              <Input
                placeholder="ex: COLISSIMO"
                value={formCarrier}
                onChange={(e) => setFormCarrier(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Poids min (g) *</label>
                <Input
                  type="number"
                  min="0"
                  value={formWeightMin}
                  onChange={(e) => setFormWeightMin(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Poids max (g) *</label>
                <Input
                  type="number"
                  min="0"
                  value={formWeightMax}
                  onChange={(e) => setFormWeightMax(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prix (EUR) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
              />
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
            <DialogTitle>Supprimer la regle</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer cette regle tarifaire ?
              {selectedRule && (
                <span className="block mt-2 font-medium">
                  {selectedRule.carrier}: {formatWeight(selectedRule.weight_min_grams)} - {formatWeight(selectedRule.weight_max_grams)} = {selectedRule.price_eur.toFixed(2)} EUR
                </span>
              )}
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

function PricingLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
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
