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
  AlertTriangle, Search, X, Download, Loader2, Plus, Eye, Edit2, Clock,
  CheckCircle, XCircle, FileText, ChevronDown, ChevronUp, Euro
} from 'lucide-react'
import {
  useClaims, useUpdateClaim, useCreateClaim, useClaimHistory,
  ClaimFilters, Claim, ClaimStatus, ClaimType, ClaimPriority,
  CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS, CLAIM_PRIORITY_LABELS
} from '@/hooks/useClaims'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusBadge(status: ClaimStatus) {
  const variants: Record<ClaimStatus, 'warning' | 'blue' | 'success' | 'error' | 'muted'> = {
    ouverte: 'warning',
    en_analyse: 'blue',
    indemnisee: 'success',
    refusee: 'error',
    cloturee: 'muted',
  }
  return <Badge variant={variants[status]}>{CLAIM_STATUS_LABELS[status]}</Badge>
}

function getTypeBadge(type: ClaimType) {
  return <Badge variant="outline">{CLAIM_TYPE_LABELS[type]}</Badge>
}

function getPriorityBadge(priority: ClaimPriority) {
  const variants: Record<ClaimPriority, 'error' | 'warning' | 'muted' | 'info'> = {
    urgent: 'error',
    high: 'warning',
    normal: 'muted',
    low: 'info',
  }
  return <Badge variant={variants[priority]} className="text-xs">{CLAIM_PRIORITY_LABELS[priority]}</Badge>
}

interface ClaimRowProps {
  claim: Claim
  onView: (claim: Claim) => void
  onEdit: (claim: Claim) => void
}

function ClaimRow({ claim, onView, onEdit }: ClaimRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isOverdue = claim.resolution_deadline &&
    new Date(claim.resolution_deadline) < new Date() &&
    !['indemnisee', 'refusee', 'cloturee'].includes(claim.status)

  return (
    <>
      <TableRow
        className="group cursor-pointer hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="pl-4 lg:pl-6">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
          {formatDate(claim.opened_at)}
        </TableCell>
        <TableCell className="font-mono font-medium text-sm">
          {claim.order_ref || claim.shipments?.order_ref || '-'}
        </TableCell>
        <TableCell>
          {getTypeBadge(claim.claim_type)}
        </TableCell>
        <TableCell>
          {getStatusBadge(claim.status)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {getPriorityBadge(claim.priority)}
            {isOverdue && (
              <Badge variant="error" className="text-[10px]">En retard</Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {claim.shipments?.carrier ? (
            <Badge variant="muted" className="text-xs">{claim.shipments.carrier}</Badge>
          ) : '-'}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {claim.indemnity_eur ? `${claim.indemnity_eur.toFixed(2)} €` : '-'}
        </TableCell>
      </TableRow>

      {/* Expanded Details */}
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={8} className="p-0">
            <div className="p-4 lg:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Description */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Description
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {claim.description || 'Aucune description'}
                  </p>
                </div>

                {/* Expédition liée */}
                {claim.shipments && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-primary" />
                      Expédition liée
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID Sendcloud</span>
                        <span className="font-mono">{claim.shipments.sendcloud_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Référence</span>
                        <span className="font-mono">{claim.shipments.order_ref || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transporteur</span>
                        <span>{claim.shipments.carrier || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Infos complémentaires / Décision */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    {claim.status === 'indemnisee' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : claim.status === 'refusee' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : claim.status === 'cloturee' ? (
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Clock className="h-4 w-4 text-primary" />
                    )}
                    {['indemnisee', 'refusee', 'cloturee'].includes(claim.status) ? 'Résolution' : 'Échéance'}
                  </h4>
                  <div className="space-y-1 text-sm">
                    {claim.indemnity_eur && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Indemnité</span>
                        <span className="font-medium text-green-600">{claim.indemnity_eur.toFixed(2)} €</span>
                      </div>
                    )}
                    {claim.decided_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date décision</span>
                        <span>{formatDate(claim.decided_at)}</span>
                      </div>
                    )}
                    {!['indemnisee', 'refusee', 'cloturee'].includes(claim.status) && claim.resolution_deadline && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date limite</span>
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(claim.resolution_deadline)}
                        </span>
                      </div>
                    )}
                    {claim.decision_note && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <span className="font-medium">Note: </span>
                        <span className="text-muted-foreground">{claim.decision_note}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onView(claim)
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Historique
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(claim)
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function ReclamationsClient() {
  const [filters, setFilters] = useState<ClaimFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    order_ref: '',
    description: '',
    claim_type: 'other' as ClaimType,
    priority: 'normal' as ClaimPriority,
    status: 'ouverte' as ClaimStatus,
    indemnity_eur: '',
    decision_note: '',
  })

  const { data, isLoading } = useClaims(filters)
  const createMutation = useCreateClaim()
  const updateMutation = useUpdateClaim()

  const claims = data?.claims || []
  const stats = data?.stats || { total: 0, open: 0, inProgress: 0, closed: 0, totalIndemnity: 0, overdue: 0 }

  const updateFilter = (key: keyof ClaimFilters, value: string | undefined) => {
    setFilters(prev => {
      const next = { ...prev }
      if (value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next as any)[key] = value
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
      const exportData = claims.map((c) => ({
        date_ouverture: c.opened_at ? formatDate(c.opened_at) : '',
        reference: c.order_ref || c.shipments?.order_ref || '',
        type: CLAIM_TYPE_LABELS[c.claim_type],
        statut: CLAIM_STATUS_LABELS[c.status],
        priorite: CLAIM_PRIORITY_LABELS[c.priority],
        transporteur: c.shipments?.carrier || '',
        description: c.description || '',
        indemnite: c.indemnity_eur || '',
        date_decision: c.decided_at ? formatDate(c.decided_at) : '',
        note_decision: c.decision_note || '',
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `reclamations_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  const openCreateDialog = () => {
    setFormData({
      order_ref: '',
      description: '',
      claim_type: 'other',
      priority: 'normal',
      status: 'ouverte',
      indemnity_eur: '',
      decision_note: '',
    })
    setCreateDialogOpen(true)
  }

  const openEditDialog = (claim: Claim) => {
    setSelectedClaim(claim)
    setFormData({
      order_ref: claim.order_ref || '',
      description: claim.description || '',
      claim_type: claim.claim_type,
      priority: claim.priority,
      status: claim.status,
      indemnity_eur: claim.indemnity_eur?.toString() || '',
      decision_note: claim.decision_note || '',
    })
    setEditDialogOpen(true)
  }

  const openHistoryDialog = (claim: Claim) => {
    setSelectedClaim(claim)
    setHistoryDialogOpen(true)
  }

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({
        order_ref: formData.order_ref || undefined,
        description: formData.description || undefined,
        claim_type: formData.claim_type,
        priority: formData.priority,
      })
      setCreateDialogOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  const handleUpdate = async () => {
    if (!selectedClaim) return
    try {
      await updateMutation.mutateAsync({
        id: selectedClaim.id,
        status: formData.status,
        description: formData.description || null,
        claim_type: formData.claim_type,
        priority: formData.priority,
        indemnity_eur: formData.indemnity_eur ? parseFloat(formData.indemnity_eur) : null,
        decision_note: formData.decision_note || null,
      })
      setEditDialogOpen(false)
    } catch {
      // Error handled by mutation
    }
  }

  const hasFilters = Object.keys(filters).length > 0

  if (isLoading) {
    return <ReclamationsLoadingSkeleton />
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Réclamations</h1>
          <p className="text-muted-foreground text-sm">
            {stats.total} réclamation(s) au total
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle réclamation
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Total</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <FileText className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Ouvertes</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.open}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-amber-100 rounded-lg text-amber-600">
              <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">En analyse</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.inProgress}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-blue-100 rounded-lg text-blue-600">
              <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className={`shadow-sm border-border ${stats.overdue > 0 ? 'border-red-300' : ''}`}>
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">En retard</p>
              <p className={`text-lg lg:text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.overdue}
              </p>
            </div>
            <div className={`p-1.5 lg:p-2 rounded-lg ${stats.overdue > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              <XCircle className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Indemnisé</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.totalIndemnity.toFixed(0)} €</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-green-100 rounded-lg text-green-600">
              <Euro className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-white p-3 lg:p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par référence, description..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onBlur={handleSearch}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => updateFilter('status', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="ouverte">Ouvertes</SelectItem>
                <SelectItem value="en_analyse">En analyse</SelectItem>
                <SelectItem value="indemnisee">Indemnisées</SelectItem>
                <SelectItem value="refusee">Refusées</SelectItem>
                <SelectItem value="cloturee">Clôturées</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.claim_type || 'all'}
              onValueChange={(v) => updateFilter('claim_type', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="lost">Colis perdu</SelectItem>
                <SelectItem value="damaged">Endommagé</SelectItem>
                <SelectItem value="delay">Retard</SelectItem>
                <SelectItem value="wrong_content">Contenu erroné</SelectItem>
                <SelectItem value="missing_items">Articles manquants</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.priority || 'all'}
              onValueChange={(v) => updateFilter('priority', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="normal">Normale</SelectItem>
                <SelectItem value="low">Basse</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            type="date"
            className="w-[130px] sm:w-[150px]"
            value={filters.from || ''}
            onChange={(e) => updateFilter('from', e.target.value || undefined)}
          />
          <span className="text-muted-foreground text-sm">-</span>
          <Input
            type="date"
            className="w-[130px] sm:w-[150px]"
            value={filters.to || ''}
            onChange={(e) => updateFilter('to', e.target.value || undefined)}
          />
          <div className="flex-1" />
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
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        {claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucune réclamation trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 w-10"></TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Référence</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">Statut</TableHead>
                  <TableHead className="whitespace-nowrap">Priorité</TableHead>
                  <TableHead className="whitespace-nowrap">Transporteur</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Indemnité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <ClaimRow
                    key={claim.id}
                    claim={claim}
                    onView={openHistoryDialog}
                    onEdit={openEditDialog}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouvelle réclamation</DialogTitle>
            <DialogDescription>
              Créer une nouvelle réclamation SAV
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Référence commande</label>
              <Input
                placeholder="Ex: CMD-12345"
                value={formData.order_ref}
                onChange={(e) => setFormData(prev => ({ ...prev, order_ref: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={formData.claim_type}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, claim_type: v as ClaimType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lost">Colis perdu</SelectItem>
                    <SelectItem value="damaged">Endommagé</SelectItem>
                    <SelectItem value="delay">Retard</SelectItem>
                    <SelectItem value="wrong_content">Contenu erroné</SelectItem>
                    <SelectItem value="missing_items">Articles manquants</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priorité</label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v as ClaimPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="low">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Décrivez le problème..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier la réclamation</DialogTitle>
            <DialogDescription>
              Mettre à jour les informations de la réclamation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Statut</label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as ClaimStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ouverte">Ouverte</SelectItem>
                    <SelectItem value="en_analyse">En analyse</SelectItem>
                    <SelectItem value="indemnisee">Indemnisée</SelectItem>
                    <SelectItem value="refusee">Refusée</SelectItem>
                    <SelectItem value="cloturee">Clôturée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priorité</label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v as ClaimPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="low">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={formData.claim_type}
                onValueChange={(v) => setFormData(prev => ({ ...prev, claim_type: v as ClaimType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lost">Colis perdu</SelectItem>
                  <SelectItem value="damaged">Endommagé</SelectItem>
                  <SelectItem value="delay">Retard</SelectItem>
                  <SelectItem value="wrong_content">Contenu erroné</SelectItem>
                  <SelectItem value="missing_items">Articles manquants</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            {(formData.status === 'indemnisee' || formData.status === 'refusee') && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Indemnité (EUR)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.indemnity_eur}
                    onChange={(e) => setFormData(prev => ({ ...prev, indemnity_eur: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note de décision</label>
                  <textarea
                    className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Raison de la décision..."
                    value={formData.decision_note}
                    onChange={(e) => setFormData(prev => ({ ...prev, decision_note: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <HistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        claimId={selectedClaim?.id || ''}
      />
    </div>
  )
}

function HistoryDialog({ open, onOpenChange, claimId }: { open: boolean; onOpenChange: (open: boolean) => void; claimId: string }) {
  const { data: history, isLoading } = useClaimHistory(claimId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Historique des modifications</DialogTitle>
        </DialogHeader>
        <div className="py-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="border-l-2 border-primary/30 pl-4 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(entry.changed_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  {entry.profiles && (
                    <p className="text-xs text-muted-foreground">
                      Par {entry.profiles.full_name || entry.profiles.email}
                    </p>
                  )}
                  {entry.note && (
                    <p className="text-sm mt-1 italic text-muted-foreground">"{entry.note}"</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">Aucun historique</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReclamationsLoadingSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-7 lg:h-8 w-36 lg:w-48" />
          <Skeleton className="h-4 w-28 lg:w-32" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-3 lg:p-4">
            <Skeleton className="h-3 lg:h-4 w-16 lg:w-20 mb-2" />
            <Skeleton className="h-6 lg:h-8 w-12 lg:w-16" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
