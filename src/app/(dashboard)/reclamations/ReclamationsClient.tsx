'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  useClaims,
  useCreateClaim,
  useUpdateClaim,
  useDeleteClaim,
  useBulkUpdateClaims,
  useClaimHistory,
  type Claim,
  type ClaimStatus,
  type ClaimType,
  type ClaimPriority,
  type ClaimFilters,
  CLAIM_TYPE_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_PRIORITY_LABELS,
} from '@/hooks/useClaims'
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
  LayoutGrid,
  List,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Timer,
  FileWarning,
  PackageX,
  HelpCircle,
  ChevronRight,
  Filter,
  X,
  Loader2,
  History,
  ArrowRight,
  Calendar,
  Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

// Status columns for Kanban
const STATUS_COLUMNS: { status: ClaimStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { status: 'ouverte', label: 'Ouvertes', color: 'bg-amber-500', icon: <AlertTriangle className="h-4 w-4" /> },
  { status: 'en_analyse', label: 'En analyse', color: 'bg-blue-500', icon: <Clock className="h-4 w-4" /> },
  { status: 'indemnisee', label: 'Indemnisées', color: 'bg-green-500', icon: <CheckCircle className="h-4 w-4" /> },
  { status: 'refusee', label: 'Refusées', color: 'bg-red-500', icon: <XCircle className="h-4 w-4" /> },
  { status: 'cloturee', label: 'Clôturées', color: 'bg-gray-500', icon: <CheckCircle className="h-4 w-4" /> },
]

// Type icons
const TYPE_ICONS: Record<ClaimType, React.ReactNode> = {
  lost: <PackageX className="h-4 w-4" />,
  damaged: <Package className="h-4 w-4" />,
  delay: <Timer className="h-4 w-4" />,
  wrong_content: <FileWarning className="h-4 w-4" />,
  missing_items: <Package className="h-4 w-4" />,
  other: <HelpCircle className="h-4 w-4" />,
}

// Priority colors
const PRIORITY_COLORS: Record<ClaimPriority, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
}

export function ReclamationsClient() {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [filters, setFilters] = useState<ClaimFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null)
  const [historyClaimId, setHistoryClaimId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data, isLoading } = useClaims(filters)
  const createMutation = useCreateClaim()
  const updateMutation = useUpdateClaim()
  const deleteMutation = useDeleteClaim()
  const bulkUpdateMutation = useBulkUpdateClaims()

  const claims = data?.claims || []
  const stats = data?.stats

  // Group claims by status for Kanban
  const claimsByStatus = useMemo(() => {
    const grouped: Record<ClaimStatus, Claim[]> = {
      ouverte: [],
      en_analyse: [],
      indemnisee: [],
      refusee: [],
      cloturee: [],
    }
    for (const claim of claims) {
      grouped[claim.status]?.push(claim)
    }
    return grouped
  }, [claims])

  // Handlers
  const handleStatusChange = (claimId: string, newStatus: ClaimStatus) => {
    updateMutation.mutate({ id: claimId, status: newStatus })
  }

  const handleBulkStatusChange = (newStatus: ClaimStatus) => {
    if (selectedIds.size === 0) return
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      data: { status: newStatus },
    })
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const selectAll = () => {
    if (selectedIds.size === claims.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(claims.map(c => c.id)))
    }
  }

  const exportCSV = () => {
    const headers = ['Ref', 'Type', 'Priorite', 'Description', 'Statut', 'Indemnite', 'Date', 'Deadline']
    const rows = claims.map(c => [
      c.order_ref || c.shipments?.order_ref || '',
      CLAIM_TYPE_LABELS[c.claim_type] || '',
      CLAIM_PRIORITY_LABELS[c.priority] || '',
      c.description || '',
      CLAIM_STATUS_LABELS[c.status],
      c.indemnity_eur?.toString() || '',
      format(new Date(c.opened_at), 'dd/MM/yyyy'),
      c.resolution_deadline ? format(new Date(c.resolution_deadline), 'dd/MM/yyyy') : '',
    ])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reclamations_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (isLoading) {
    return <ReclamationsLoading />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Réclamations SAV</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez et suivez toutes les réclamations clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total"
          value={stats?.total || 0}
          icon={<Package className="h-5 w-5" />}
          color="bg-gray-100 text-gray-700"
        />
        <StatCard
          label="Ouvertes"
          value={stats?.open || 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="bg-amber-100 text-amber-700"
          alert={stats?.open ? stats.open > 0 : false}
        />
        <StatCard
          label="En analyse"
          value={stats?.inProgress || 0}
          icon={<Clock className="h-5 w-5" />}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          label="En retard"
          value={stats?.overdue || 0}
          icon={<Flame className="h-5 w-5" />}
          color="bg-red-100 text-red-700"
          alert={stats?.overdue ? stats.overdue > 0 : false}
        />
        <StatCard
          label="Indemnisé"
          value={`${(stats?.totalIndemnity || 0).toFixed(2)} €`}
          icon={<CheckCircle className="h-5 w-5" />}
          color="bg-green-100 text-green-700"
        />
      </div>

      {/* Filters & View Toggle */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par référence, description..."
              className="pl-10"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          {/* Quick filters */}
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtres
              {Object.values(filters).filter(Boolean).length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {Object.values(filters).filter(Boolean).length}
                </Badge>
              )}
            </Button>

            <div className="border-l h-6 mx-2" />

            {/* View toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7"
                onClick={() => setViewMode('kanban')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            <Select
              value={filters.status || '_all_'}
              onValueChange={(v) => setFilters({ ...filters, status: v === '_all_' ? undefined : v as ClaimStatus })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tous statuts</SelectItem>
                {STATUS_COLUMNS.map(col => (
                  <SelectItem key={col.status} value={col.status}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.claim_type || '_all_'}
              onValueChange={(v) => setFilters({ ...filters, claim_type: v === '_all_' ? undefined : v as ClaimType })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Tous types</SelectItem>
                {Object.entries(CLAIM_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.priority || '_all_'}
              onValueChange={(v) => setFilters({ ...filters, priority: v === '_all_' ? undefined : v as ClaimPriority })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Toutes</SelectItem>
                {Object.entries(CLAIM_PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {Object.values(filters).some(Boolean) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({})}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Effacer
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.size} réclamation(s) sélectionnée(s)
            </span>
            <div className="flex items-center gap-2">
              <Select onValueChange={(v) => handleBulkStatusChange(v as ClaimStatus)}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Changer le statut..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map(col => (
                    <SelectItem key={col.status} value={col.status}>{col.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {viewMode === 'kanban' ? (
        <KanbanView
          claimsByStatus={claimsByStatus}
          onStatusChange={handleStatusChange}
          onEdit={setEditingClaim}
          onDelete={setDeleteConfirm}
          onHistory={setHistoryClaimId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <TableView
          claims={claims}
          onStatusChange={handleStatusChange}
          onEdit={setEditingClaim}
          onDelete={setDeleteConfirm}
          onHistory={setHistoryClaimId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
        />
      )}

      {/* Dialogs */}
      <CreateClaimDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={(data) => {
          createMutation.mutate(data)
          setCreateDialogOpen(false)
        }}
        isLoading={createMutation.isPending}
      />

      <EditClaimDialog
        claim={editingClaim}
        onOpenChange={(open) => !open && setEditingClaim(null)}
        onSave={(data) => {
          if (editingClaim) {
            updateMutation.mutate({ id: editingClaim.id, ...data })
            setEditingClaim(null)
          }
        }}
        isLoading={updateMutation.isPending}
      />

      <HistoryDialog
        claimId={historyClaimId}
        onOpenChange={(open) => !open && setHistoryClaimId(null)}
      />

      <DeleteConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            deleteMutation.mutate(deleteConfirm)
            setDeleteConfirm(null)
          }
        }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// Stat Card Component
function StatCard({ label, value, icon, color, alert }: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  alert?: boolean
}) {
  return (
    <Card className={cn('p-4', alert && 'ring-2 ring-amber-400')}>
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', color)}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  )
}

// Kanban View
function KanbanView({
  claimsByStatus,
  onStatusChange,
  onEdit,
  onDelete,
  onHistory,
  selectedIds,
  onToggleSelect,
}: {
  claimsByStatus: Record<ClaimStatus, Claim[]>
  onStatusChange: (id: string, status: ClaimStatus) => void
  onEdit: (claim: Claim) => void
  onDelete: (id: string) => void
  onHistory: (id: string) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_COLUMNS.map((col) => (
        <div key={col.status} className="flex-shrink-0 w-72">
          {/* Column header */}
          <div className={cn('flex items-center gap-2 p-3 rounded-t-xl text-white', col.color)}>
            {col.icon}
            <span className="font-semibold">{col.label}</span>
            <Badge variant="secondary" className="ml-auto bg-white/20 text-white">
              {claimsByStatus[col.status]?.length || 0}
            </Badge>
          </div>

          {/* Column content */}
          <div className="bg-gray-50 rounded-b-xl p-2 min-h-[400px] space-y-2">
            {claimsByStatus[col.status]?.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
                onHistory={onHistory}
                isSelected={selectedIds.has(claim.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}

            {claimsByStatus[col.status]?.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                Aucune réclamation
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Claim Card for Kanban
function ClaimCard({
  claim,
  onStatusChange,
  onEdit,
  onDelete,
  onHistory,
  isSelected,
  onToggleSelect,
}: {
  claim: Claim
  onStatusChange: (id: string, status: ClaimStatus) => void
  onEdit: (claim: Claim) => void
  onDelete: (id: string) => void
  onHistory: (id: string) => void
  isSelected: boolean
  onToggleSelect: (id: string) => void
}) {
  const isOverdue = claim.resolution_deadline &&
    new Date(claim.resolution_deadline) < new Date() &&
    !['indemnisee', 'refusee', 'cloturee'].includes(claim.status)

  return (
    <Card
      className={cn(
        'p-3 cursor-pointer hover:shadow-md transition-shadow',
        isSelected && 'ring-2 ring-primary',
        isOverdue && 'border-red-300 bg-red-50/50'
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(claim.id)}
          onClick={(e) => e.stopPropagation()}
        />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-medium truncate">
              {claim.order_ref || claim.shipments?.order_ref || 'N/A'}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(claim)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onHistory(claim.id)}>
                  <History className="h-4 w-4 mr-2" />
                  Historique
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {STATUS_COLUMNS.filter(c => c.status !== claim.status).map(col => (
                  <DropdownMenuItem
                    key={col.status}
                    onClick={() => onStatusChange(claim.id, col.status)}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    {col.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(claim.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Type & Priority badges */}
          <div className="flex items-center gap-1.5 mt-2">
            <Badge variant="outline" className="text-[10px] gap-1">
              {TYPE_ICONS[claim.claim_type || 'other']}
              {CLAIM_TYPE_LABELS[claim.claim_type || 'other']}
            </Badge>
            <Badge className={cn('text-[10px]', PRIORITY_COLORS[claim.priority || 'normal'])}>
              {CLAIM_PRIORITY_LABELS[claim.priority || 'normal']}
            </Badge>
          </div>

          {/* Description */}
          {claim.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {claim.description}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(claim.opened_at), { addSuffix: true, locale: fr })}
            </span>
            {claim.indemnity_eur && (
              <span className="font-semibold text-green-600">
                {claim.indemnity_eur.toFixed(2)} €
              </span>
            )}
          </div>

          {/* Overdue warning */}
          {isOverdue && (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-red-600 font-medium">
              <Flame className="h-3 w-3" />
              SLA dépassé
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// Table View
function TableView({
  claims,
  onStatusChange,
  onEdit,
  onDelete,
  onHistory,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: {
  claims: Claim[]
  onStatusChange: (id: string, status: ClaimStatus) => void
  onEdit: (claim: Claim) => void
  onDelete: (id: string) => void
  onHistory: (id: string) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 text-left">
                <Checkbox
                  checked={selectedIds.size === claims.length && claims.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Référence</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Type</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Priorité</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Description</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Statut</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Indemnité</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Date</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const isOverdue = claim.resolution_deadline &&
                new Date(claim.resolution_deadline) < new Date() &&
                !['indemnisee', 'refusee', 'cloturee'].includes(claim.status)

              return (
                <tr
                  key={claim.id}
                  className={cn(
                    'border-b hover:bg-muted/30 transition-colors',
                    isOverdue && 'bg-red-50'
                  )}
                >
                  <td className="p-3">
                    <Checkbox
                      checked={selectedIds.has(claim.id)}
                      onCheckedChange={() => onToggleSelect(claim.id)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {claim.order_ref || claim.shipments?.order_ref || 'N/A'}
                      </span>
                      {isOverdue && <Flame className="h-4 w-4 text-red-500" />}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="gap-1">
                      {TYPE_ICONS[claim.claim_type || 'other']}
                      <span className="hidden lg:inline">{CLAIM_TYPE_LABELS[claim.claim_type || 'other']}</span>
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge className={cn('text-xs', PRIORITY_COLORS[claim.priority || 'normal'])}>
                      {CLAIM_PRIORITY_LABELS[claim.priority || 'normal']}
                    </Badge>
                  </td>
                  <td className="p-3 max-w-xs hidden md:table-cell">
                    <span className="text-sm text-muted-foreground truncate block">
                      {claim.description || '-'}
                    </span>
                  </td>
                  <td className="p-3">
                    <Select
                      value={claim.status}
                      onValueChange={(v) => onStatusChange(claim.id, v as ClaimStatus)}
                    >
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_COLUMNS.map(col => (
                          <SelectItem key={col.status} value={col.status}>
                            <span className="flex items-center gap-2">
                              {col.icon}
                              {col.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    {claim.indemnity_eur ? (
                      <span className="font-semibold text-green-600">
                        {claim.indemnity_eur.toFixed(2)} €
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(claim.opened_at), 'dd/MM/yy')}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(claim)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onHistory(claim.id)}>
                          <History className="h-4 w-4 mr-2" />
                          Historique
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(claim.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {claims.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucune réclamation trouvée
          </div>
        )}
      </div>
    </Card>
  )
}

// Create Claim Dialog
function CreateClaimDialog({
  open,
  onOpenChange,
  onCreate,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: { order_ref?: string; description?: string; claim_type?: ClaimType; priority?: ClaimPriority }) => void
  isLoading: boolean
}) {
  const [orderRef, setOrderRef] = useState('')
  const [description, setDescription] = useState('')
  const [claimType, setClaimType] = useState<ClaimType>('other')
  const [priority, setPriority] = useState<ClaimPriority>('normal')

  const handleSubmit = () => {
    onCreate({
      order_ref: orderRef || undefined,
      description: description || undefined,
      claim_type: claimType,
      priority,
    })
    setOrderRef('')
    setDescription('')
    setClaimType('other')
    setPriority('normal')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle réclamation</DialogTitle>
          <DialogDescription>
            Créez une nouvelle réclamation SAV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Référence commande</label>
            <Input
              placeholder="Ex: CMD-12345"
              value={orderRef}
              onChange={(e) => setOrderRef(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={claimType} onValueChange={(v) => setClaimType(v as ClaimType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLAIM_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        {TYPE_ICONS[k as ClaimType]}
                        {v}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priorité</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ClaimPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLAIM_PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Décrivez le problème..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Edit Claim Dialog
function EditClaimDialog({
  claim,
  onOpenChange,
  onSave,
  isLoading,
}: {
  claim: Claim | null
  onOpenChange: (open: boolean) => void
  onSave: (data: Partial<Claim>) => void
  isLoading: boolean
}) {
  const [status, setStatus] = useState<ClaimStatus>('ouverte')
  const [claimType, setClaimType] = useState<ClaimType>('other')
  const [priority, setPriority] = useState<ClaimPriority>('normal')
  const [description, setDescription] = useState('')
  const [indemnity, setIndemnity] = useState('')
  const [decisionNote, setDecisionNote] = useState('')

  // Sync with claim when it changes
  useEffect(() => {
    if (claim) {
      setStatus(claim.status)
      setClaimType(claim.claim_type || 'other')
      setPriority(claim.priority || 'normal')
      setDescription(claim.description || '')
      setIndemnity(claim.indemnity_eur?.toString() || '')
      setDecisionNote(claim.decision_note || '')
    }
  }, [claim])

  if (!claim) return null

  return (
    <Dialog open={!!claim} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la réclamation</DialogTitle>
          <DialogDescription>
            {claim.order_ref || claim.shipments?.order_ref || 'N/A'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Statut</label>
              <Select value={status} onValueChange={(v) => setStatus(v as ClaimStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map(col => (
                    <SelectItem key={col.status} value={col.status}>{col.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={claimType} onValueChange={(v) => setClaimType(v as ClaimType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLAIM_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priorité</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ClaimPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLAIM_PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Décrivez le problème..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Indemnité (EUR)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={indemnity}
              onChange={(e) => setIndemnity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Note de décision</label>
            <Textarea
              placeholder="Raison de la décision..."
              rows={2}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => onSave({
              status,
              claim_type: claimType,
              priority,
              description: description || null,
              indemnity_eur: indemnity ? parseFloat(indemnity) : null,
              decision_note: decisionNote || null,
            })}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// History Dialog
function HistoryDialog({
  claimId,
  onOpenChange,
}: {
  claimId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: history, isLoading } = useClaimHistory(claimId || '')

  if (!claimId) return null

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Créée'
      case 'status_changed': return 'Statut modifié'
      case 'indemnity_set': return 'Indemnité définie'
      case 'updated': return 'Modifiée'
      default: return action
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return <Plus className="h-4 w-4 text-green-500" />
      case 'status_changed': return <ArrowRight className="h-4 w-4 text-blue-500" />
      case 'indemnity_set': return <CheckCircle className="h-4 w-4 text-green-500" />
      default: return <Pencil className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <Dialog open={!!claimId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des modifications
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry, idx) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="p-1.5 bg-muted rounded-full">
                      {getActionIcon(entry.action)}
                    </div>
                    {idx < history.length - 1 && (
                      <div className="w-px h-full bg-border mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {getActionLabel(entry.action)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.changed_at), 'dd/MM/yy HH:mm', { locale: fr })}
                      </span>
                    </div>
                    {entry.profiles && (
                      <p className="text-xs text-muted-foreground">
                        par {entry.profiles.full_name || entry.profiles.email}
                      </p>
                    )}
                    {entry.old_value && entry.new_value && (
                      <div className="mt-2 text-xs bg-muted p-2 rounded">
                        {Object.keys(entry.new_value).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="line-through text-red-500">
                              {String((entry.old_value as Record<string, unknown>)[key] || '-')}
                            </span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-green-600">
                              {String((entry.new_value as Record<string, unknown>)[key] || '-')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {entry.note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun historique disponible
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Delete Confirm Dialog
function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isLoading: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Supprimer la réclamation
          </DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Êtes-vous sûr de vouloir supprimer cette réclamation ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Loading skeleton
function ReclamationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="flex gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-[400px] w-72" />
        ))}
      </div>
    </div>
  )
}
