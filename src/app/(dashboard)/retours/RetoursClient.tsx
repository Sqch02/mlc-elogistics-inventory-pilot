'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  RotateCcw, Package, ExternalLink, Search, X, Download, Loader2,
  ChevronDown, ChevronUp, MapPin, Phone, Mail, User,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw,
  CheckCircle2, XCircle, PackagePlus
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useReturns,
  useSyncReturns,
  useRestockReturn,
  ReturnFilters,
  Return,
  ReturnStatus,
  RestockStatus,
  RETURN_STATUS_LABELS,
  RETURN_REASON_LABELS,
  RESTOCK_STATUS_LABELS
} from '@/hooks/useReturns'
import { useTenant } from '@/components/providers/TenantProvider'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { formatCarrierName } from '@/lib/utils'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusBadge(status: ReturnStatus) {
  const variants: Record<ReturnStatus, 'success' | 'warning' | 'error' | 'info' | 'muted' | 'blue' | 'cyan' | 'purple' | 'indigo'> = {
    announced: 'cyan',
    ready: 'blue',
    in_transit: 'indigo',
    at_carrier: 'purple',
    delivered: 'success',
    cancelled: 'error',
  }
  return <Badge variant={variants[status] || 'muted'}>{RETURN_STATUS_LABELS[status] || status}</Badge>
}

function getRestockBadge(status: RestockStatus | null) {
  if (!status || status === 'not_applicable') return <Badge variant="muted">N/A</Badge>
  const variants: Record<RestockStatus, 'success' | 'warning' | 'error' | 'muted'> = {
    pending: 'warning',
    validated: 'success',
    rejected: 'error',
    not_applicable: 'muted',
  }
  return <Badge variant={variants[status] || 'muted'}>{RESTOCK_STATUS_LABELS[status] || status}</Badge>
}

function getReasonBadge(reason: string | null) {
  if (!reason) return <Badge variant="muted">-</Badge>
  const variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'muted'> = {
    refund: 'info',
    exchange: 'warning',
    defective: 'error',
    wrong_item: 'warning',
    other: 'muted',
  }
  return <Badge variant={variants[reason] || 'muted'}>{RETURN_REASON_LABELS[reason as keyof typeof RETURN_REASON_LABELS] || reason}</Badge>
}

interface ReturnRowProps {
  returnItem: Return
  isClient: boolean
  onRestock: (returnItem: Return, action: 'validate' | 'reject') => void
}

function ReturnRow({ returnItem, isClient, onRestock }: ReturnRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const colSpan = isClient ? 9 : 10

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
          {formatDate(returnItem.created_at)}
        </TableCell>
        <TableCell className="font-mono font-medium text-sm">
          #{returnItem.order_ref || '-'}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm">{returnItem.sender_name || '-'}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {returnItem.sender_country_code && (
                <span className="text-[10px]">
                  {returnItem.sender_country_code === 'FR' ? '🇫🇷' :
                    returnItem.sender_country_code === 'BE' ? '🇧🇪' :
                      returnItem.sender_country_code === 'DE' ? '🇩🇪' :
                        returnItem.sender_country_code}
                </span>
              )}
              {returnItem.sender_city || ''}
            </span>
          </div>
        </TableCell>
        <TableCell>
          {getStatusBadge(returnItem.status)}
        </TableCell>
        <TableCell>
          {getReasonBadge(returnItem.return_reason)}
        </TableCell>
        <TableCell>
          {returnItem.carrier ? (
            <Badge variant="muted" className="text-xs">{formatCarrierName(returnItem.carrier)}</Badge>
          ) : '-'}
        </TableCell>
        <TableCell>
          {getRestockBadge(returnItem.restock_status)}
        </TableCell>
        <TableCell className={isClient ? 'text-right pr-4 lg:pr-6' : ''}>
          {returnItem.tracking_url ? (
            <a
              href={returnItem.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : returnItem.tracking_number ? (
            <span className="font-mono text-xs text-muted-foreground">{returnItem.tracking_number.slice(-8)}</span>
          ) : '-'}
        </TableCell>
        {!isClient && (
          <TableCell className="text-right pr-4 lg:pr-6">
            {returnItem.restock_status === 'pending' && returnItem.status === 'delivered' && (
              <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => onRestock(returnItem, 'validate')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Valider
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onRestock(returnItem, 'reject')}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Rejeter
                </Button>
              </div>
            )}
            {returnItem.restock_status === 'validated' && returnItem.restock_qty && (
              <span className="text-xs text-green-600">+{returnItem.restock_qty} unites</span>
            )}
          </TableCell>
        )}
      </TableRow>

      {/* Expanded Details */}
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={colSpan} className="p-0">
            <div className="p-4 lg:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Expéditeur (Client) */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Expéditeur (Client)
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">{returnItem.sender_name || '-'}</p>
                    {returnItem.sender_company && (
                      <p className="text-muted-foreground">{returnItem.sender_company}</p>
                    )}
                    {returnItem.sender_email && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <a href={`mailto:${returnItem.sender_email}`} className="hover:text-primary">
                          {returnItem.sender_email}
                        </a>
                      </p>
                    )}
                    {returnItem.sender_phone && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <a href={`tel:${returnItem.sender_phone}`} className="hover:text-primary">
                          {returnItem.sender_phone}
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                {/* Adresse */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Adresse d&apos;expédition
                  </h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{returnItem.sender_address || '-'}</p>
                    <p>{returnItem.sender_postal_code} {returnItem.sender_city}</p>
                    <p>{returnItem.sender_country_code || '-'}</p>
                  </div>
                </div>

                {/* Détails retour */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-primary" />
                    Détails du retour
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Raison</span>
                      {getReasonBadge(returnItem.return_reason)}
                    </div>
                    {returnItem.return_reason_comment && (
                      <div>
                        <span className="text-muted-foreground block">Commentaire</span>
                        <span className="text-xs">{returnItem.return_reason_comment}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transporteur</span>
                      <span className="font-medium">{formatCarrierName(returnItem.carrier)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span className="text-xs">{returnItem.service || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Remise en stock</span>
                      {getRestockBadge(returnItem.restock_status)}
                    </div>
                    {returnItem.restock_qty != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Qte remise</span>
                        <span className="font-medium text-green-600">+{returnItem.restock_qty}</span>
                      </div>
                    )}
                    {returnItem.restock_note && (
                      <div>
                        <span className="text-muted-foreground block">Note restock</span>
                        <span className="text-xs">{returnItem.restock_note}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* IDs & Dates */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Créé le</span>
                    <span className="font-mono">{formatDate(returnItem.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Annoncé le</span>
                    <span className="font-mono">{formatDate(returnItem.announced_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">ID Sendcloud</span>
                    <span className="font-mono">{returnItem.sendcloud_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Tracking</span>
                    <span className="font-mono">{returnItem.tracking_number || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex flex-wrap gap-2">
                {returnItem.tracking_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={returnItem.tracking_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Suivre le retour
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function RetoursClient() {
  const { isClient } = useTenant()
  const [filters, setFilters] = useState<ReturnFilters>({ page: 1, pageSize: 50 })
  const [searchInput, setSearchInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Restock dialog state
  const [restockDialog, setRestockDialog] = useState<{
    open: boolean
    returnItem: Return | null
    action: 'validate' | 'reject'
  }>({ open: false, returnItem: null, action: 'validate' })
  const [restockQty, setRestockQty] = useState(1)
  const [restockNote, setRestockNote] = useState('')

  const { data, isLoading, isFetching } = useReturns(filters)
  const syncMutation = useSyncReturns()
  const restockMutation = useRestockReturn()

  const returns = data?.returns || []
  const pagination = data?.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 1 }
  const stats = data?.stats || { total: 0, announced: 0, in_transit: 0, delivered: 0, byReason: { refund: 0, exchange: 0, defective: 0, wrong_item: 0, other: 0 } }

  const updateFilter = (key: keyof ReturnFilters, value: string | undefined) => {
    setFilters(prev => {
      const next = { ...prev, page: 1 }
      if (value) {
        // @ts-expect-error - dynamic key assignment
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
    setFilters({ page: 1, pageSize: 50 })
    setSearchInput('')
  }

  const goToPage = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportData = returns.map((r) => ({
        date: r.created_at ? formatDate(r.created_at) : '',
        reference: r.order_ref || '',
        expediteur: r.sender_name || '',
        email: r.sender_email || '',
        telephone: r.sender_phone || '',
        adresse: r.sender_address || '',
        ville: r.sender_city || '',
        code_postal: r.sender_postal_code || '',
        pays: r.sender_country_code || '',
        transporteur: formatCarrierName(r.carrier) || '',
        statut: RETURN_STATUS_LABELS[r.status] || r.status,
        raison: r.return_reason ? RETURN_REASON_LABELS[r.return_reason] : '',
        tracking: r.tracking_number || '',
        restock: r.restock_status ? RESTOCK_STATUS_LABELS[r.restock_status] : '',
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `retours_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  const openRestockDialog = (returnItem: Return, action: 'validate' | 'reject') => {
    setRestockDialog({ open: true, returnItem, action })
    setRestockQty(1)
    setRestockNote('')
  }

  const handleRestockSubmit = () => {
    if (!restockDialog.returnItem) return

    restockMutation.mutate({
      returnId: restockDialog.returnItem.id,
      action: restockDialog.action,
      restock_qty: restockDialog.action === 'validate' ? restockQty : undefined,
      note: restockNote || undefined,
    }, {
      onSuccess: () => {
        setRestockDialog({ open: false, returnItem: null, action: 'validate' })
      }
    })
  }

  const hasFilters = Object.keys(filters).filter(k => k !== 'page' && k !== 'pageSize').length > 0

  if (isLoading) {
    return <RetoursLoadingSkeleton />
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Retours</h1>
          <p className="text-muted-foreground text-sm">
            {stats.total} retour(s) {isFetching && '(chargement...)'}
          </p>
        </div>
        <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Synchroniser
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Total Retours</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <RotateCcw className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">En transit</p>
              <p className="text-lg lg:text-2xl font-bold text-indigo-600">{stats.in_transit}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <Package className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Déclarés</p>
              <p className="text-lg lg:text-2xl font-bold text-cyan-600">{stats.announced}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-cyan-100 rounded-lg text-cyan-600">
              <RotateCcw className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Livrés</p>
              <p className="text-lg lg:text-2xl font-bold text-green-600">{stats.delivered}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-green-100 rounded-lg text-green-600">
              <Package className="h-4 w-4 lg:h-5 lg:w-5" />
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
              placeholder="Rechercher (ref, nom, tracking)..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onBlur={handleSearch}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => updateFilter('status', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="announced">Déclaré</SelectItem>
                <SelectItem value="ready">Prêt</SelectItem>
                <SelectItem value="in_transit">En transit</SelectItem>
                <SelectItem value="delivered">Livré</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.reason || 'all'}
              onValueChange={(v) => updateFilter('reason', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Raison" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="refund">Remboursement</SelectItem>
                <SelectItem value="exchange">Échange</SelectItem>
                <SelectItem value="defective">Défectueux</SelectItem>
                <SelectItem value="wrong_item">Mauvais article</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
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
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        {returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <RotateCcw className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucun retour trouvé</p>
            <p className="text-xs mt-2">Cliquez sur &quot;Synchroniser&quot; pour importer les retours depuis Sendcloud</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 w-10"></TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Commande</TableHead>
                  <TableHead className="whitespace-nowrap">Client</TableHead>
                  <TableHead className="whitespace-nowrap">Statut</TableHead>
                  <TableHead className="whitespace-nowrap">Raison</TableHead>
                  <TableHead className="whitespace-nowrap">Transporteur</TableHead>
                  <TableHead className="whitespace-nowrap">Restock</TableHead>
                  <TableHead className="whitespace-nowrap">Tracking</TableHead>
                  {!isClient && <TableHead className="text-right pr-4 lg:pr-6 whitespace-nowrap">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((returnItem) => (
                  <ReturnRow
                    key={returnItem.id}
                    returnItem={returnItem}
                    isClient={isClient}
                    onRestock={openRestockDialog}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 lg:p-4 rounded-2xl border border-border shadow-sm">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} sur {pagination.totalPages} ({pagination.total} retours)
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(1)}
              disabled={pagination.page === 1 || isFetching}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page === 1 || isFetching}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1
                } else if (pagination.page <= 3) {
                  pageNum = i + 1
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i
                } else {
                  pageNum = pagination.page - 2 + i
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === pagination.page ? 'default' : 'ghost'}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => goToPage(pageNum)}
                    disabled={isFetching}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages || isFetching}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages || isFetching}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Restock Validation Dialog */}
      <Dialog open={restockDialog.open} onOpenChange={(open) => {
        if (!open) setRestockDialog({ open: false, returnItem: null, action: 'validate' })
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {restockDialog.action === 'validate' ? (
                <>
                  <PackagePlus className="h-5 w-5 text-green-600" />
                  Valider la remise en stock
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Rejeter la remise en stock
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {restockDialog.action === 'validate'
                ? `Retour #${restockDialog.returnItem?.order_ref || '-'} - Confirmer la remise en stock et la quantité.`
                : `Retour #${restockDialog.returnItem?.order_ref || '-'} - Ce retour ne sera pas remis en stock.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {restockDialog.action === 'validate' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantité à remettre en stock</label>
                <Input
                  type="number"
                  min={1}
                  value={restockQty}
                  onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {restockDialog.action === 'validate' ? 'Note (optionnel)' : 'Raison du rejet'}
              </label>
              <Textarea
                placeholder={restockDialog.action === 'validate'
                  ? 'Commentaire sur la remise en stock...'
                  : 'Raison du rejet (produit endommage, etc.)...'
                }
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestockDialog({ open: false, returnItem: null, action: 'validate' })}
            >
              Annuler
            </Button>
            <Button
              variant={restockDialog.action === 'validate' ? 'default' : 'destructive'}
              onClick={handleRestockSubmit}
              disabled={restockMutation.isPending}
            >
              {restockMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {restockDialog.action === 'validate' ? 'Valider la remise en stock' : 'Rejeter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RetoursLoadingSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-7 lg:h-8 w-36 lg:w-48" />
          <Skeleton className="h-4 w-28 lg:w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
