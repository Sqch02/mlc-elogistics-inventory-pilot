'use client'

import { useState } from 'react'
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
  Clock, Package, Truck, Filter, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInbound, useCreateInbound, useInboundAction, useDeleteInbound, InboundEntry, INBOUND_STATUS_LABELS } from '@/hooks/useInbound'
import { useSkus } from '@/hooks/useSkus'
import { useTenant } from '@/components/providers/TenantProvider'
import { toast } from 'sonner'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusBadge(status: string) {
  const variants: Record<string, 'warning' | 'success' | 'error' | 'muted' | 'blue'> = {
    pending: 'warning',
    accepted: 'success',
    rejected: 'error',
    received: 'blue',
  }
  return <Badge variant={variants[status] || 'muted'}>{INBOUND_STATUS_LABELS[status] || status}</Badge>
}

export function ArrivagesClient() {
  const { isClient } = useTenant()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<InboundEntry | null>(null)
  const [actionType, setActionType] = useState<'accept' | 'reject'>('accept')

  const { data: entries, isLoading } = useInbound({ status: statusFilter, search })
  const createMutation = useCreateInbound()
  const actionMutation = useInboundAction()
  const deleteMutation = useDeleteInbound()
  const { data: skusData } = useSkus()

  const skus = skusData?.skus || []

  // KPI counts
  const pendingCount = entries?.filter(e => e.status === 'pending').length || 0
  const acceptedCount = entries?.filter(e => e.status === 'accepted').length || 0
  const rejectedCount = entries?.filter(e => e.status === 'rejected').length || 0

  const handleAction = (entry: InboundEntry, action: 'accept' | 'reject') => {
    setSelectedEntry(entry)
    setActionType(action)
    setShowActionDialog(true)
  }

  const handleDelete = async (entry: InboundEntry) => {
    if (!confirm('Supprimer cet arrivage ?')) return
    try {
      await deleteMutation.mutateAsync(entry.id)
      toast.success('Arrivage supprime')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
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
                placeholder="Rechercher par fournisseur, note, reference..."
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

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantite</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date creation</TableHead>
                {!isClient && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!entries || entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isClient ? 7 : 8} className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun arrivage trouve</p>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {entry.skus?.sku_code || '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {entry.skus?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.accepted_qty != null ? (
                        <span>
                          <span className="text-emerald-600">{entry.accepted_qty}</span>
                          {entry.accepted_qty !== entry.qty && (
                            <span className="text-muted-foreground text-xs ml-1">/ {entry.qty}</span>
                          )}
                        </span>
                      ) : (
                        entry.qty
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(entry.eta_date)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.supplier || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(entry.created_at)}</TableCell>
                    {!isClient && (
                      <TableCell className="text-right">
                        {entry.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleAction(entry, 'accept')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Accepter
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleAction(entry, 'reject')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Rejeter
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() => handleDelete(entry)}
                            >
                              Suppr.
                            </Button>
                          </div>
                        )}
                        {entry.status !== 'pending' && (
                          <span className="text-xs text-muted-foreground">
                            {entry.reviewed_at ? formatDate(entry.reviewed_at) : '-'}
                          </span>
                        )}
                      </TableCell>
                    )}
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

      {/* Action Dialog (Accept/Reject) */}
      {selectedEntry && (
        <ActionDialog
          open={showActionDialog}
          onClose={() => { setShowActionDialog(false); setSelectedEntry(null) }}
          entry={selectedEntry}
          action={actionType}
          mutation={actionMutation}
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
  const emptyLine = (): ItemLine => ({ skuId: '', qty: '', skuSearch: '', showDropdown: false })
  const [items, setItems] = useState<ItemLine[]>([emptyLine()])
  const [etaDate, setEtaDate] = useState('')
  const [supplier, setSupplier] = useState('')
  const [batchRef, setBatchRef] = useState('')
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
        items: validItems.map(i => ({ sku_id: i.skuId, qty: Number(i.qty) })),
        eta_date: etaDate,
        supplier: supplier || undefined,
        batch_reference: batchRef || undefined,
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
              <label className="text-sm font-medium">Reference lot</label>
              <Input
                value={batchRef}
                onChange={(e) => setBatchRef(e.target.value)}
                placeholder="Ex: LOT-2026-001"
              />
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
// Action Dialog (Accept/Reject)
// ==========================
function ActionDialog({
  open,
  onClose,
  entry,
  action,
  mutation,
}: {
  open: boolean
  onClose: () => void
  entry: InboundEntry
  action: 'accept' | 'reject'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation: any
}) {
  const [acceptedQty, setAcceptedQty] = useState(String(entry.qty))
  const [note, setNote] = useState(entry.note || '')

  const isAccept = action === 'accept'
  const title = isAccept ? 'Accepter l\'arrivage' : 'Rejeter l\'arrivage'
  const description = isAccept
    ? 'Confirmez la quantite recue. Le stock sera mis a jour automatiquement.'
    : 'Indiquez la raison du rejet.'

  const handleSubmit = async () => {
    try {
      await mutation.mutateAsync({
        id: entry.id,
        action,
        ...(isAccept && { accepted_qty: Number(acceptedQty) }),
        ...(note && { note }),
      })
      toast.success(isAccept ? 'Arrivage accepte - stock mis a jour' : 'Arrivage rejete')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAccept ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">{entry.skus?.sku_code} - {entry.skus?.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Quantite declaree: {entry.qty} | ETA: {formatDate(entry.eta_date)}
              {entry.supplier && ` | Fournisseur: ${entry.supplier}`}
            </p>
          </div>

          {isAccept && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantite recue</label>
              <Input
                type="number"
                min="0"
                value={acceptedQty}
                onChange={(e) => setAcceptedQty(e.target.value)}
              />
              {Number(acceptedQty) !== entry.qty && (
                <p className="text-xs text-amber-600">
                  Difference de {Number(acceptedQty) - entry.qty} par rapport a la declaration
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">{isAccept ? 'Note (optionnel)' : 'Raison du rejet'}</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isAccept ? 'Commentaire' : 'Indiquez la raison...'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            variant={isAccept ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isAccept ? 'Accepter' : 'Rejeter'}
          </Button>
        </DialogFooter>
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
