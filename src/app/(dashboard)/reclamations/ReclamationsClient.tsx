'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, MessageSquare, AlertTriangle, CheckCircle, Clock, Loader2, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClaims, useCreateClaim, useUpdateClaim, useDeleteClaim, Claim } from '@/hooks/useClaims'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ouverte':
      return <Badge variant="default">Ouvert</Badge>
    case 'en_analyse':
      return <Badge variant="warning">En analyse</Badge>
    case 'indemnisee':
      return <Badge variant="success">Indemnisee</Badge>
    case 'refusee':
      return <Badge variant="destructive">Refusee</Badge>
    case 'cloturee':
      return <Badge variant="secondary">Cloturee</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export function ReclamationsClient() {
  const [isExporting, setIsExporting] = useState(false)

  // CRUD Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  // Form states
  const [formOrderRef, setFormOrderRef] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStatus, setFormStatus] = useState<string>('ouverte')
  const [formIndemnity, setFormIndemnity] = useState<number | null>(null)
  const [formDecisionNote, setFormDecisionNote] = useState('')

  const { data, isLoading, isFetching } = useClaims()

  const createMutation = useCreateClaim()
  const updateMutation = useUpdateClaim()
  const deleteMutation = useDeleteClaim()

  const claims = data?.claims || []
  const stats = data?.stats || {
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    totalIndemnity: 0,
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportData = claims.map(c => ({
        ref_commande: c.order_ref || '-',
        transporteur: c.shipments?.carrier || '-',
        description: c.description || '-',
        statut: c.status,
        indemnite_eur: c.indemnity_eur || 0,
        date_ouverture: formatDate(c.opened_at),
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `reclamations_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  // Open create dialog
  const openCreate = () => {
    setFormOrderRef('')
    setFormDescription('')
    setCreateOpen(true)
  }

  // Open edit dialog
  const openEdit = (claim: Claim) => {
    setSelectedClaim(claim)
    setFormDescription(claim.description || '')
    setFormStatus(claim.status)
    setFormIndemnity(claim.indemnity_eur)
    setFormDecisionNote(claim.decision_note || '')
    setEditOpen(true)
  }

  // Open delete dialog
  const openDelete = (claim: Claim) => {
    setSelectedClaim(claim)
    setDeleteOpen(true)
  }

  // Handle create submit
  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        order_ref: formOrderRef.trim() || undefined,
        description: formDescription.trim() || undefined,
      })
      setCreateOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle edit submit
  const handleEdit = async () => {
    if (!selectedClaim) return

    try {
      await updateMutation.mutateAsync({
        id: selectedClaim.id,
        status: formStatus,
        description: formDescription.trim() || null,
        indemnity_eur: formIndemnity,
        decision_note: formDecisionNote.trim() || null,
      })
      setEditOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Handle quick status change
  const handleQuickStatusChange = async (id: string, status: string) => {
    try {
      await updateMutation.mutateAsync({ id, status })
    } catch {
      // Error handled by mutation
    }
  }

  // Handle delete submit
  const handleDelete = async () => {
    if (!selectedClaim) return

    try {
      await deleteMutation.mutateAsync(selectedClaim.id)
      setDeleteOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  if (isLoading) {
    return <ReclamationsLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reclamations</h1>
          <p className="text-muted-foreground text-sm">
            {claims.length} reclamation(s) {isFetching && '(chargement...)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle
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
              <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className={`shadow-sm border-border ${stats.open > 0 ? 'border-amber-300' : ''}`}>
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Ouvertes</p>
              <p className={`text-lg lg:text-2xl font-bold ${stats.open > 0 ? 'text-amber-600' : ''}`}>{stats.open}</p>
            </div>
            <div className={`p-1.5 lg:p-2 rounded-lg ${stats.open > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
              <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">En analyse</p>
              <p className="text-lg lg:text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-blue-100 rounded-lg text-blue-600">
              <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Indemnites</p>
              <p className="text-lg lg:text-2xl font-bold text-green-600">{stats.totalIndemnity.toFixed(2)} EUR</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-green-100 rounded-lg text-green-600">
              <CheckCircle className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        {claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucune reclamation</p>
            <Button variant="link" size="sm" className="mt-2" onClick={openCreate}>
              Creer une reclamation
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 whitespace-nowrap">Ref.</TableHead>
                  <TableHead className="hidden sm:table-cell whitespace-nowrap">Transporteur</TableHead>
                  <TableHead className="hidden lg:table-cell">Description</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Indemnite</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
                  <TableHead className="w-[60px] pr-4 lg:pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id} className="group">
                    <TableCell className="font-mono font-medium pl-4 lg:pl-6 text-xs lg:text-sm">
                      {claim.order_ref || claim.shipments?.order_ref || '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {claim.shipments?.carrier ? (
                        <Badge variant="muted" className="text-xs">{claim.shipments.carrier}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground hidden lg:table-cell">
                      {claim.description || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs lg:text-sm whitespace-nowrap">
                      {formatDate(claim.opened_at)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                      {claim.indemnity_eur ? `${Number(claim.indemnity_eur).toFixed(2)} EUR` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={claim.status}
                        onValueChange={(value) => handleQuickStatusChange(claim.id, value)}
                        disabled={updateMutation.isPending}
                      >
                        <SelectTrigger className="w-[100px] lg:w-[130px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ouverte">Ouverte</SelectItem>
                          <SelectItem value="en_analyse">En analyse</SelectItem>
                          <SelectItem value="indemnisee">Indemnisee</SelectItem>
                          <SelectItem value="refusee">Refusee</SelectItem>
                          <SelectItem value="cloturee">Cloturee</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="pr-4 lg:pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(claim)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-error" onClick={() => openDelete(claim)}>
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
          </div>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle reclamation</DialogTitle>
            <DialogDescription>
              Creez un ticket pour signaler un probleme.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference commande</label>
              <Input
                placeholder="ex: 400123"
                value={formOrderRef}
                onChange={(e) => setFormOrderRef(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Decrivez le probleme..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={4}
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
            <DialogTitle>Modifier la reclamation</DialogTitle>
            <DialogDescription>
              Modifiez les details de la reclamation {selectedClaim?.order_ref || selectedClaim?.shipments?.order_ref}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Statut</label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ouverte">Ouverte</SelectItem>
                  <SelectItem value="en_analyse">En analyse</SelectItem>
                  <SelectItem value="indemnisee">Indemnisee</SelectItem>
                  <SelectItem value="refusee">Refusee</SelectItem>
                  <SelectItem value="cloturee">Cloturee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Decrivez le probleme..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Indemnite (EUR)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formIndemnity ?? ''}
                onChange={(e) => setFormIndemnity(e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Note de decision</label>
              <Textarea
                placeholder="Raison de la decision..."
                value={formDecisionNote}
                onChange={(e) => setFormDecisionNote(e.target.value)}
                rows={2}
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
            <DialogTitle>Supprimer la reclamation</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer la reclamation {selectedClaim?.order_ref || selectedClaim?.shipments?.order_ref} ?
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

function ReclamationsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-24" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
