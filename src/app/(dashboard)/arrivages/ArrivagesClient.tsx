'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PackagePlus, Search, Plus, Loader2, CheckCircle, XCircle,
  Clock, Package, Truck, Filter, Trash2, Eye, Layers,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useInbound, useCreateInbound, useInboundAction, useDeleteInbound, InboundEntry, INBOUND_STATUS_LABELS } from '@/hooks/useInbound'
import { useSkus } from '@/hooks/useSkus'
import { useTenant } from '@/components/providers/TenantProvider'
import { toast } from 'sonner'

function getStatusBadge(status: string) {
  const variants: Record<string, 'warning' | 'success' | 'error' | 'muted' | 'blue'> = {
    pending: 'warning',
    accepted: 'success',
    rejected: 'error',
    received: 'blue',
  }
  return <Badge variant={variants[status] || 'muted'}>{INBOUND_STATUS_LABELS[status] || status}</Badge>
}

// Determine the overall status of a group of entries
function getGroupStatus(entries: InboundEntry[]): string {
  const statuses = new Set(entries.map(e => e.status))
  if (statuses.size === 1) return entries[0].status
  if (statuses.has('pending')) return 'pending'
  if (statuses.has('rejected')) return 'rejected'
  return entries[0].status
}

interface InboundGroup {
  groupId: string
  entries: InboundEntry[]
  batchReference: string | null
  supplier: string | null
  etaDate: string
  nbPalettes: number | null
  status: string
  totalQty: number
  createdAt: string
}

function groupEntries(entries: InboundEntry[]): InboundGroup[] {
  const map = new Map<string, InboundEntry[]>()
  for (const entry of entries) {
    const key = entry.group_id || entry.id
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }
  const groups: InboundGroup[] = []
  for (const [groupId, groupEntries] of map) {
    const first = groupEntries[0]
    groups.push({
      groupId,
      entries: groupEntries,
      batchReference: first.batch_reference,
      supplier: first.supplier,
      etaDate: first.eta_date,
      nbPalettes: first.nb_palettes,
      status: getGroupStatus(groupEntries),
      totalQty: groupEntries.reduce((sum, e) => sum + e.qty, 0),
      createdAt: first.created_at,
    })
  }
  groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return groups
}

export function ArrivagesClient() {
  const { isClient } = useTenant()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<InboundGroup | null>(null)

  const { data: entries, isLoading } = useInbound({ status: statusFilter, search })
  const createMutation = useCreateInbound()
  const actionMutation = useInboundAction()
  const deleteMutation = useDeleteInbound()
  const { data: skusData } = useSkus()

  const skus = skusData?.skus || []

  const groups = useMemo(() => groupEntries(entries || []), [entries])

  // KPI counts (based on groups)
  const pendingCount = groups.filter(g => g.status === 'pending').length
  const acceptedCount = groups.filter(g => g.status === 'accepted').length
  const rejectedCount = groups.filter(g => g.status === 'rejected').length

  const handleGroupClick = (group: InboundGroup) => {
    setSelectedGroup(group)
    setShowDetailDialog(true)
  }

  if (isLoading) {
    return <ArrivagesLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <PackagePlus className="h-6 w-6 text-primary" />
            Arrivages de Stock
          </h1>
          <p className="text-muted-foreground text-sm">
            Declaration et suivi des arrivees de marchandise
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Declarer un arrivage
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="shadow-sm cursor-pointer" onClick={() => setStatusFilter('pending')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">En attente</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm cursor-pointer" onClick={() => setStatusFilter('accepted')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Acceptes</p>
                <p className="text-2xl font-bold">{acceptedCount}</p>
              </div>
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm cursor-pointer" onClick={() => setStatusFilter('rejected')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Rejetes</p>
                <p className="text-2xl font-bold">{rejectedCount}</p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg text-red-600">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par fournisseur, note, N BL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="accepted">Accepte</SelectItem>
                <SelectItem value="rejected">Rejete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table - Grouped by arrivage */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° BL</TableHead>
                <TableHead>Produits</TableHead>
                <TableHead>Palettes</TableHead>
                <TableHead className="text-right">Qty totale</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun arrivage trouve</p>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow
                    key={group.groupId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleGroupClick(group)}
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {group.batchReference || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted" className="gap-1">
                        <Layers className="h-3 w-3" />
                        {group.entries.length} produit{group.entries.length > 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {group.nbPalettes != null ? group.nbPalettes : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{group.totalQty}</TableCell>
                    <TableCell className="text-sm">{formatDate(group.etaDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {group.supplier || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(group.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); handleGroupClick(group) }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateInboundDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        skus={skus}
        mutation={createMutation}
      />

      {/* Detail Dialog */}
      {selectedGroup && (
        <DetailDialog
          open={showDetailDialog}
          onClose={() => { setShowDetailDialog(false); setSelectedGroup(null) }}
          group={selectedGroup}
          isClient={isClient}
          actionMutation={actionMutation}
          deleteMutation={deleteMutation}
        />
      )}
    </div>
  )
}

// ==========================
// Create Dialog (Multi-SKU)
// ==========================
interface ItemLine {
  skuId: string
  qty: string
  lotNumber: string
  skuSearch: string
  showDropdown: boolean
}

function CreateInboundDialog({
  open,
  onClose,
  skus,
  mutation,
}: {
  open: boolean
  onClose: () => void
  skus: { id: string; sku_code: string; name: string }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation: any
}) {
  const emptyLine = (): ItemLine => ({ skuId: '', qty: '', lotNumber: '', skuSearch: '', showDropdown: false })
  const [items, setItems] = useState<ItemLine[]>([emptyLine()])
  const [etaDate, setEtaDate] = useState('')
  const [supplier, setSupplier] = useState('')
  const [batchRef, setBatchRef] = useState('')
  const [nbPalettes, setNbPalettes] = useState('')
  const [note, setNote] = useState('')

  const updateItem = (index: number, updates: Partial<ItemLine>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item))
  }

  const addItem = () => setItems(prev => [...prev, emptyLine()])

  const removeItem = (index: number) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const getFilteredSkus = (search: string) =>
    skus.filter(s =>
      s.sku_code.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
    )

  const handleSubmit = async () => {
    const validItems = items.filter(i => i.skuId && i.qty)
    if (validItems.length === 0 || !etaDate) {
      toast.error('Ajoutez au moins un produit avec quantite et une date ETA')
      return
    }
    try {
      await mutation.mutateAsync({
        items: validItems.map(i => ({
          sku_id: i.skuId,
          qty: Number(i.qty),
          ...(i.lotNumber && { lot_number: i.lotNumber }),
        })),
        eta_date: etaDate,
        supplier: supplier || undefined,
        batch_reference: batchRef || undefined,
        nb_palettes: nbPalettes ? Number(nbPalettes) : undefined,
        note: note || undefined,
      })
      toast.success(validItems.length > 1
        ? `${validItems.length} produits declares avec succes`
        : 'Arrivage declare avec succes'
      )
      onClose()
      setItems([emptyLine()])
      setEtaDate('')
      setSupplier('')
      setBatchRef('')
      setNbPalettes('')
      setNote('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Declarer un arrivage
          </DialogTitle>
          <DialogDescription>
            Declarez une arrivee de marchandise. Vous pouvez ajouter plusieurs produits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Item lines */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Produits *</label>
            {items.map((item, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-5">{index + 1}.</span>
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Rechercher un SKU..."
                      value={item.skuSearch}
                      onChange={(e) => updateItem(index, { skuSearch: e.target.value, showDropdown: true })}
                      onFocus={() => updateItem(index, { showDropdown: true })}
                      className="text-sm"
                    />
                    {item.showDropdown && item.skuSearch && (
                      <div className="absolute z-10 w-full mt-1 max-h-32 overflow-y-auto border rounded-md bg-background shadow-md">
                        {getFilteredSkus(item.skuSearch).length === 0 ? (
                          <p className="p-2 text-xs text-muted-foreground">Aucun SKU trouve</p>
                        ) : (
                          getFilteredSkus(item.skuSearch).slice(0, 10).map(s => (
                            <button
                              key={s.id}
                              className={cn(
                                'w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors',
                                item.skuId === s.id && 'bg-primary/10'
                              )}
                              onClick={() => updateItem(index, { skuId: s.id, skuSearch: s.sku_code, showDropdown: false })}
                            >
                              <span className="font-mono font-medium text-xs">{s.sku_code}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{s.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <Input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItem(index, { qty: e.target.value })}
                    placeholder="Qty"
                    className="w-24 text-sm"
                  />
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="pl-7">
                  <Input
                    value={item.lotNumber}
                    onChange={(e) => updateItem(index, { lotNumber: e.target.value })}
                    placeholder="N° de lot (optionnel)"
                    className="text-sm h-8"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={addItem}
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter un produit
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date ETA *</label>
              <Input
                type="date"
                value={etaDate}
                onChange={(e) => setEtaDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fournisseur</label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nom du fournisseur"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Numero BL</label>
              <Input
                value={batchRef}
                onChange={(e) => setBatchRef(e.target.value)}
                placeholder="Ex: BL-2026-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre de palettes</label>
              <Input
                type="number"
                min="0"
                value={nbPalettes}
                onChange={(e) => setNbPalettes(e.target.value)}
                placeholder="Ex: 2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Note</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Commentaire optionnel"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Declarer {items.filter(i => i.skuId && i.qty).length > 1
              ? `(${items.filter(i => i.skuId && i.qty).length} produits)`
              : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==========================
// Detail Dialog (Group view)
// ==========================
function DetailDialog({
  open,
  onClose,
  group,
  isClient,
  actionMutation,
  deleteMutation,
}: {
  open: boolean
  onClose: () => void
  group: InboundGroup
  isClient: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actionMutation: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteMutation: any
}) {
  const [controlMode, setControlMode] = useState(false)
  // Map of entry.id -> { qty: string, note: string }
  const [controlData, setControlData] = useState<Record<string, { qty: string; note: string }>>({})

  const hasPendingEntries = group.entries.some(e => e.status === 'pending')
  const pendingEntries = group.entries.filter(e => e.status === 'pending')

  const startControl = () => {
    const initial: Record<string, { qty: string; note: string }> = {}
    for (const entry of pendingEntries) {
      initial[entry.id] = { qty: String(entry.qty), note: '' }
    }
    setControlData(initial)
    setControlMode(true)
  }

  const updateControlQty = (id: string, qty: string) => {
    setControlData(prev => ({ ...prev, [id]: { ...prev[id], qty } }))
  }

  const updateControlNote = (id: string, note: string) => {
    setControlData(prev => ({ ...prev, [id]: { ...prev[id], note } }))
  }

  const handleValidateControl = async () => {
    try {
      for (const entry of pendingEntries) {
        const data = controlData[entry.id]
        if (!data) continue
        const receivedQty = Number(data.qty)
        await actionMutation.mutateAsync({
          id: entry.id,
          action: 'accept' as const,
          accepted_qty: receivedQty,
          ...(data.note && { note: data.note }),
        })
      }
      toast.success(`${pendingEntries.length} produit${pendingEntries.length > 1 ? 's' : ''} controle${pendingEntries.length > 1 ? 's' : ''} et accepte${pendingEntries.length > 1 ? 's' : ''}`)
      setControlMode(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleRejectAll = async () => {
    try {
      for (const entry of pendingEntries) {
        await actionMutation.mutateAsync({
          id: entry.id,
          action: 'reject' as const,
        })
      }
      toast.success(`${pendingEntries.length} produit${pendingEntries.length > 1 ? 's' : ''} rejete${pendingEntries.length > 1 ? 's' : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleDeleteGroup = async () => {
    if (!confirm('Supprimer tout cet arrivage ?')) return
    try {
      for (const entry of group.entries) {
        await deleteMutation.mutateAsync(entry.id)
      }
      toast.success('Arrivage supprime')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // Check if any qty differs from declared in control mode
  const hasDifferences = controlMode && pendingEntries.some(e => {
    const data = controlData[e.id]
    return data && Number(data.qty) !== e.qty
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detail de l&apos;arrivage
          </DialogTitle>
          <DialogDescription>
            {group.batchReference ? `BL: ${group.batchReference}` : 'Sans numero BL'}
            {group.supplier && ` | Fournisseur: ${group.supplier}`}
          </DialogDescription>
        </DialogHeader>

        {/* Header info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">N° BL</p>
            <p className="text-sm font-medium">{group.batchReference || '-'}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Palettes</p>
            <p className="text-sm font-medium">{group.nbPalettes != null ? group.nbPalettes : '-'}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">ETA</p>
            <p className="text-sm font-medium">{formatDate(group.etaDate)}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Statut</p>
            <div className="mt-0.5">{getStatusBadge(group.status)}</div>
          </div>
        </div>

        {group.entries[0]?.note && (
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <span className="font-medium">Note :</span> {group.entries[0].note}
          </div>
        )}

        {/* Products table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>N° Lot</TableHead>
                <TableHead className="text-right">Qty declaree</TableHead>
                <TableHead className="text-right">{controlMode ? 'Qty recue' : 'Qty recue'}</TableHead>
                {controlMode && <TableHead>Note</TableHead>}
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.entries.map((entry) => {
                const isEntryPending = entry.status === 'pending'
                const data = controlData[entry.id]
                const qtyDiff = controlMode && isEntryPending && data ? Number(data.qty) - entry.qty : 0

                return (
                  <TableRow key={entry.id} className={controlMode && isEntryPending && qtyDiff !== 0 ? 'bg-amber-50' : ''}>
                    <TableCell className="font-mono text-xs font-medium">
                      {entry.skus?.sku_code || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {entry.skus?.name || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.lot_number || '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{entry.qty}</TableCell>
                    <TableCell className="text-right text-sm">
                      {controlMode && isEntryPending && data ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            min="0"
                            value={data.qty}
                            onChange={(e) => updateControlQty(entry.id, e.target.value)}
                            className="h-7 w-20 text-sm text-right"
                          />
                          {qtyDiff !== 0 && (
                            <span className={cn('text-xs font-medium', qtyDiff < 0 ? 'text-amber-600' : 'text-emerald-600')}>
                              {qtyDiff > 0 ? '+' : ''}{qtyDiff}
                            </span>
                          )}
                        </div>
                      ) : entry.accepted_qty != null ? (
                        <span className={entry.accepted_qty === entry.qty ? 'text-emerald-600' : 'text-amber-600'}>
                          {entry.accepted_qty}
                          {entry.accepted_qty !== entry.qty && (
                            <span className="text-xs ml-1">({entry.accepted_qty - entry.qty > 0 ? '+' : ''}{entry.accepted_qty - entry.qty})</span>
                          )}
                        </span>
                      ) : '-'}
                    </TableCell>
                    {controlMode && (
                      <TableCell>
                        {isEntryPending && data ? (
                          <Input
                            value={data.note}
                            onChange={(e) => updateControlNote(entry.id, e.target.value)}
                            placeholder="Casse, manquant..."
                            className="h-7 text-xs w-32"
                          />
                        ) : null}
                      </TableCell>
                    )}
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Difference summary in control mode */}
        {controlMode && hasDifferences && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <p className="font-medium text-amber-800">Differences detectees :</p>
            <ul className="mt-1 space-y-0.5">
              {pendingEntries.filter(e => {
                const data = controlData[e.id]
                return data && Number(data.qty) !== e.qty
              }).map(e => {
                const data = controlData[e.id]
                const diff = Number(data.qty) - e.qty
                return (
                  <li key={e.id} className="text-amber-700 text-xs">
                    {e.skus?.sku_code} : {e.qty} declarees, {data.qty} recues ({diff > 0 ? '+' : ''}{diff})
                    {data.note && <span className="italic ml-1">- {data.note}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Footer actions */}
        {!isClient && hasPendingEntries && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!controlMode ? (
              <>
                {group.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={handleDeleteGroup}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Supprimer
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleRejectAll}
                  disabled={actionMutation.isPending}
                >
                  {actionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <XCircle className="h-4 w-4 mr-1" />
                  Tout rejeter
                </Button>
                <Button onClick={startControl}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Controler et accepter
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setControlMode(false)}>
                  Annuler
                </Button>
                <div className="flex-1" />
                <Button
                  onClick={handleValidateControl}
                  disabled={actionMutation.isPending}
                >
                  {actionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Valider le controle ({pendingEntries.length} produit{pendingEntries.length > 1 ? 's' : ''})
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ==========================
// Loading Skeleton
// ==========================
function ArrivagesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
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
        <Skeleton className="h-10 w-full" />
      </Card>
      <Card className="p-0">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}
