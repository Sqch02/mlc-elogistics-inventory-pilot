'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Truck, Package, DollarSign, AlertTriangle, ExternalLink, Search, X, Download, Loader2,
  ChevronDown, ChevronUp, MapPin, Phone, Mail, User, Calendar, Globe, Tag, FileText, Eye,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, RefreshCw, XCircle,
  Clock, CheckCircle2
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCreateClaim } from '@/hooks/useClaims'
import { toast } from 'sonner'
import { useShipments, useCarriers, useCancelShipment, useRefreshShipment, ShipmentFilters, Shipment } from '@/hooks/useShipments'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateShipmentDialog } from '@/components/forms/CreateShipmentDialog'
import { Plus } from 'lucide-react'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatWeight(grams: number) {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(2)} kg`
  }
  return `${grams} g`
}

// Status badge colors based on Sendcloud status IDs
function getStatusBadge(statusId: number | null, statusMessage: string | null) {
  // Special handling for integration shipments (On Hold) - they have no status_id
  if (!statusId && statusMessage) {
    const messageStatuses: Record<string, { variant: 'success' | 'warning' | 'error' | 'info' | 'muted' | 'blue' | 'cyan' | 'purple' | 'indigo', label: string }> = {
      'On Hold': { variant: 'cyan', label: 'En attente' },
      'Ready to send': { variant: 'blue', label: 'Prêt' },
      'Cancelled': { variant: 'error', label: 'Annulé' },
    }
    const msgStatus = messageStatuses[statusMessage] || { variant: 'muted' as const, label: statusMessage }
    return <Badge variant={msgStatus.variant}>{msgStatus.label}</Badge>
  }

  if (!statusId) return <Badge variant="muted">Inconnu</Badge>

  // Sendcloud status IDs: https://support.sendcloud.com/hc/en-us/articles/360024799612-Parcel-statuses
  const statusColors: Record<number, { variant: 'success' | 'warning' | 'error' | 'info' | 'muted' | 'blue' | 'cyan' | 'purple' | 'indigo', label: string }> = {
    // Initial states
    1: { variant: 'muted', label: 'Brouillon' },
    1000: { variant: 'cyan', label: 'Prêt' },
    1001: { variant: 'cyan', label: 'En attente' },

    // In progress states
    11: { variant: 'blue', label: 'Annoncé' },
    12: { variant: 'indigo', label: 'En transit' },
    22: { variant: 'indigo', label: 'Centre de tri' },
    31: { variant: 'blue', label: 'En douane' },
    32: { variant: 'warning', label: 'Douane bloquée' },

    // Delivery states
    13: { variant: 'purple', label: 'En livraison' },
    62: { variant: 'purple', label: 'Livré au voisin' },
    80: { variant: 'blue', label: 'Point relais' },

    // Final states
    3: { variant: 'success', label: 'Livré' },
    4: { variant: 'success', label: 'Livré' },

    // Problem states
    91: { variant: 'warning', label: 'Exception' },
    92: { variant: 'warning', label: 'Retour' },
    93: { variant: 'warning', label: 'Non livrable' },
    99: { variant: 'error', label: 'Perdu' },

    // Cancelled
    2000: { variant: 'error', label: 'Annulé' },
    2001: { variant: 'error', label: 'Refusé' },
  }

  const status = statusColors[statusId] || { variant: 'muted' as const, label: statusMessage || `Status ${statusId}` }
  return <Badge variant={status.variant}>{status.label}</Badge>
}

interface ShipmentRowProps {
  shipment: Shipment
  onCreateClaim: (shipment: Shipment) => void
  onCancel: (shipmentId: string) => void
  onRefresh: (shipmentId: string) => void
  isCancelling: boolean
  isRefreshing: boolean
}

function ShipmentRow({ shipment, onCreateClaim, onCancel, onRefresh, isCancelling, isRefreshing }: ShipmentRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

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
          {formatDate(shipment.shipped_at)}
        </TableCell>
        <TableCell className="font-mono font-medium text-sm">
          {shipment.order_ref || '-'}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm">{shipment.recipient_name || '-'}</span>
            <span className="text-xs text-muted-foreground">{shipment.city || ''}</span>
          </div>
        </TableCell>
        <TableCell>
          {getStatusBadge(shipment.status_id ?? null, shipment.status_message ?? null)}
        </TableCell>
        <TableCell>
          <Badge variant="muted" className="text-xs">{shipment.carrier}</Badge>
        </TableCell>
        <TableCell className="text-xs">
          {shipment.country_code || '-'}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {shipment.total_value ? `${shipment.total_value.toFixed(2)} €` : '-'}
        </TableCell>
        <TableCell className="text-right pr-4 lg:pr-6">
          {shipment.tracking_url ? (
            <a
              href={shipment.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : shipment.tracking ? (
            <span className="font-mono text-xs text-muted-foreground">{shipment.tracking.slice(-8)}</span>
          ) : '-'}
        </TableCell>
      </TableRow>

      {/* Expanded Details */}
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={9} className="p-0">
            <div className="p-4 lg:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Destinataire */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Destinataire
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">{shipment.recipient_name || '-'}</p>
                    {shipment.recipient_company && (
                      <p className="text-muted-foreground">{shipment.recipient_company}</p>
                    )}
                    {shipment.recipient_email && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <a href={`mailto:${shipment.recipient_email}`} className="hover:text-primary">
                          {shipment.recipient_email}
                        </a>
                      </p>
                    )}
                    {shipment.recipient_phone && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <a href={`tel:${shipment.recipient_phone}`} className="hover:text-primary">
                          {shipment.recipient_phone}
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                {/* Adresse */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Adresse de livraison
                  </h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{shipment.address_line1 || '-'}</p>
                    {shipment.address_line2 && <p>{shipment.address_line2}</p>}
                    <p>{shipment.postal_code} {shipment.city}</p>
                    <p className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {shipment.country_name || shipment.country_code || '-'}
                    </p>
                    {shipment.service_point_id && (
                      <p className="text-xs">
                        <Badge variant="outline">Point relais: {shipment.service_point_id}</Badge>
                      </p>
                    )}
                  </div>
                </div>

                {/* Expédition */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    Details expedition
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transporteur</span>
                      <span className="font-medium">{shipment.carrier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium text-xs">{shipment.service || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Poids</span>
                      <span className="font-mono">{formatWeight(shipment.weight_grams)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Colis</span>
                      <span>{shipment.collo_count || 1}</span>
                    </div>
                    {shipment.is_return && (
                      <Badge variant="warning">Retour</Badge>
                    )}
                  </div>
                </div>

                {/* Facturation */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Facturation
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valeur commande</span>
                      <span className="font-medium">
                        {shipment.total_value ? `${shipment.total_value.toFixed(2)} ${shipment.currency || 'EUR'}` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cout transport</span>
                      {shipment.pricing_status === 'ok' ? (
                        <span className="font-medium text-green-600">
                          {shipment.computed_cost_eur?.toFixed(2)} EUR
                        </span>
                      ) : (
                        <Badge variant="warning">Tarif manquant</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates & IDs */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Créé le</span>
                    <span className="font-mono">{formatDateTime(shipment.date_created ?? null)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Annoncé le</span>
                    <span className="font-mono">{formatDateTime(shipment.date_announced ?? null)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Mis à jour</span>
                    <span className="font-mono">{formatDateTime(shipment.date_updated ?? null)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">ID Sendcloud</span>
                    <span className="font-mono">{shipment.sendcloud_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Tracking</span>
                    <span className="font-mono">{shipment.tracking || '-'}</span>
                  </div>
                  {shipment.external_order_id && (
                    <div>
                      <span className="text-muted-foreground block">ID Externe</span>
                      <span className="font-mono text-xs">{shipment.external_order_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex flex-wrap gap-2">
                {shipment.tracking_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-4 w-4 mr-2" />
                      Suivre le colis
                    </a>
                  </Button>
                )}
                {shipment.label_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`/api/labels/${shipment.label_url.split('/').pop()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Etiquette
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRefresh(shipment.id)
                  }}
                  disabled={isRefreshing}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Rafraîchir statut
                </Button>
                {shipment.status_id !== 2000 && shipment.status_id !== 3 && shipment.status_id !== 4 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Êtes-vous sûr de vouloir annuler cette expédition ?')) {
                        onCancel(shipment.id)
                      }
                    }}
                    disabled={isCancelling}
                    className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                  >
                    {isCancelling ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Annuler
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateClaim(shipment)
                  }}
                  className="text-amber-600 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Créer une réclamation
                </Button>
              </div>

              {/* Items */}
              {shipment.shipment_items && shipment.shipment_items.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-primary" />
                    Articles ({shipment.shipment_items.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {shipment.shipment_items.map((item, i) => (
                      <Badge key={i} variant="outline" className="text-xs py-1 px-2">
                        {item.qty}x {item.skus?.sku_code || item.skus?.name || '?'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function ExpeditionsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlSearch = searchParams.get('search')

  const [filters, setFilters] = useState<ShipmentFilters>(() => ({
    page: 1,
    pageSize: 100,
    ...(urlSearch ? { search: urlSearch } : {})
  }))
  const [searchInput, setSearchInput] = useState(urlSearch || '')
  const [isExporting, setIsExporting] = useState(false)
  const [createShipmentOpen, setCreateShipmentOpen] = useState(false)

  // Update search when URL params change (for navigation within the app)
  useEffect(() => {
    if (urlSearch && urlSearch !== filters.search) {
      setSearchInput(urlSearch)
      setFilters(prev => ({ ...prev, search: urlSearch, page: 1 }))
    }
  }, [urlSearch, filters.search])

  // Claim dialog state
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [selectedShipmentForClaim, setSelectedShipmentForClaim] = useState<Shipment | null>(null)
  const [claimDescription, setClaimDescription] = useState('')

  const { data, isLoading, isFetching } = useShipments(filters)
  const { data: carriers = [] } = useCarriers()
  const createClaimMutation = useCreateClaim()
  const cancelMutation = useCancelShipment()
  const refreshMutation = useRefreshShipment()

  const shipments = data?.shipments || []
  const pagination = data?.pagination || { page: 1, pageSize: 100, total: 0, totalPages: 1 }
  const stats = data?.stats || { totalCost: 0, totalValue: 0, missingPricing: 0 }

  // Stats (from API - covers all filtered shipments, not just current page)
  const totalShipments = pagination.total
  const totalCost = stats.totalCost
  const totalValue = stats.totalValue
  const missingPricing = stats.missingPricing

  const updateFilter = (key: 'from' | 'to' | 'carrier' | 'pricing_status' | 'search' | 'shipment_status' | 'delivery_status', value: string | undefined) => {
    setFilters(prev => {
      const next = { ...prev, page: 1 } // Reset to page 1 on filter change
      if (value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next as any)[key] = value
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (next as any)[key]
      }
      return next
    })
  }

  const handleSearch = () => {
    updateFilter('search', searchInput || undefined)
  }

  const clearFilters = () => {
    setFilters({ page: 1, pageSize: 100 })
    setSearchInput('')
    // Clear URL search param if present
    if (urlSearch) {
      router.push('/expeditions')
    }
  }

  const goToPage = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportData = shipments.map((s) => ({
        date: s.shipped_at ? formatDate(s.shipped_at) : '',
        reference: s.order_ref || '',
        destinataire: s.recipient_name || '',
        email: s.recipient_email || '',
        telephone: s.recipient_phone || '',
        adresse: s.address_line1 || '',
        ville: s.city || '',
        code_postal: s.postal_code || '',
        pays: s.country_code || '',
        transporteur: s.carrier || '',
        service: s.service || '',
        statut: s.status_message || '',
        poids_g: s.weight_grams || 0,
        tracking: s.tracking || '',
        valeur_commande: s.total_value || '',
        cout_transport: s.computed_cost_eur || '',
        statut_tarif: s.pricing_status === 'ok' ? 'OK' : 'Manquant'
      }))
      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `expeditions_${new Date().toISOString().split('T')[0]}.csv`)
    } finally {
      setIsExporting(false)
    }
  }

  const hasFilters = Object.keys(filters).length > 0

  // Handle opening claim dialog
  const handleOpenClaimDialog = (shipment: Shipment) => {
    setSelectedShipmentForClaim(shipment)
    setClaimDescription('')
    setClaimDialogOpen(true)
  }

  // Handle creating claim
  const handleCreateClaim = async () => {
    if (!selectedShipmentForClaim) return

    try {
      await createClaimMutation.mutateAsync({
        shipment_id: selectedShipmentForClaim.id,
        order_ref: selectedShipmentForClaim.order_ref || undefined,
        description: claimDescription || undefined,
      })
      setClaimDialogOpen(false)
      toast.success('Réclamation créée avec succès', {
        description: `Réf: ${selectedShipmentForClaim.order_ref || selectedShipmentForClaim.tracking || 'N/A'}`,
        action: {
          label: 'Voir',
          onClick: () => window.location.href = '/reclamations'
        }
      })
    } catch {
      // Error handled by mutation
    }
  }

  if (isLoading) {
    return <ExpeditionsLoadingSkeleton />
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Expeditions</h1>
          <p className="text-muted-foreground text-sm">
            {totalShipments} expedition(s) {isFetching && '(chargement...)'}
          </p>
        </div>
        <Button onClick={() => setCreateShipmentOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle expedition
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Expeditions</p>
              <p className="text-lg lg:text-2xl font-bold">{totalShipments}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <Truck className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Valeur totale</p>
              <p className="text-lg lg:text-2xl font-bold">{totalValue.toFixed(0)} EUR</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-blue-100 rounded-lg text-blue-600">
              <Tag className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Cout transport</p>
              <p className="text-lg lg:text-2xl font-bold">{totalCost.toFixed(2)} EUR</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <DollarSign className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className={`shadow-sm border-border ${missingPricing > 0 ? 'border-amber-300' : ''}`}>
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Tarifs manquants</p>
              <p className={`text-lg lg:text-2xl font-bold ${missingPricing > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {missingPricing}
              </p>
            </div>
            <div className={`p-1.5 lg:p-2 rounded-lg ${missingPricing > 0 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
              <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Status Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={!filters.shipment_status ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilter('shipment_status', undefined)}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Toutes
        </Button>
        <Button
          variant={filters.shipment_status === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilter('shipment_status', 'pending')}
          className={`gap-2 ${filters.shipment_status === 'pending' ? 'bg-cyan-600 hover:bg-cyan-700' : 'text-cyan-600 border-cyan-300 hover:bg-cyan-50'}`}
        >
          <Clock className="h-4 w-4" />
          En attente
        </Button>
        <Button
          variant={filters.shipment_status === 'shipped' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilter('shipment_status', 'shipped')}
          className={`gap-2 ${filters.shipment_status === 'shipped' ? 'bg-green-600 hover:bg-green-700' : 'text-green-600 border-green-300 hover:bg-green-50'}`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Expediees
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-white p-3 lg:p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (ref, nom, ville, tracking)..."
              className="pl-9 pr-9"
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value
                setSearchInput(value)
                // Auto-clear filter when input is emptied
                if (!value && filters.search) {
                  setFilters(prev => {
                    const { search, ...rest } = prev
                    return { ...rest, page: 1 }
                  })
                  if (urlSearch) {
                    router.push('/expeditions')
                  }
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onBlur={handleSearch}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setFilters(prev => {
                    const { search, ...rest } = prev
                    return { ...rest, page: 1 }
                  })
                  if (urlSearch) {
                    router.push('/expeditions')
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select
              value={filters.carrier || 'all'}
              onValueChange={(v) => updateFilter('carrier', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Transporteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {carriers.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.pricing_status || 'all'}
              onValueChange={(v) => updateFilter('pricing_status', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Tarif" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="missing">Manquant</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.delivery_status || 'all'}
              onValueChange={(v) => updateFilter('delivery_status', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Livraison" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="in_transit">En transit</SelectItem>
                <SelectItem value="delivered">Livré</SelectItem>
                <SelectItem value="issue">⚠️ Problèmes</SelectItem>
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
        {shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Truck className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucune expedition trouvee</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 w-10"></TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Reference</TableHead>
                  <TableHead className="whitespace-nowrap">Destinataire</TableHead>
                  <TableHead className="whitespace-nowrap">Statut</TableHead>
                  <TableHead className="whitespace-nowrap">Transporteur</TableHead>
                  <TableHead className="whitespace-nowrap">Pays</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Valeur</TableHead>
                  <TableHead className="text-right pr-4 lg:pr-6 whitespace-nowrap">Tracking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((shipment) => (
                  <ShipmentRow
                    key={shipment.id}
                    shipment={shipment}
                    onCreateClaim={handleOpenClaimDialog}
                    onCancel={(id) => cancelMutation.mutate(id)}
                    onRefresh={(id) => refreshMutation.mutate(id)}
                    isCancelling={cancelMutation.isPending && cancelMutation.variables === shipment.id}
                    isRefreshing={refreshMutation.isPending && refreshMutation.variables === shipment.id}
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
            Page {pagination.page} sur {pagination.totalPages} ({pagination.total} expéditions)
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
              {/* Show page numbers */}
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

      {/* Claim Creation Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Nouvelle réclamation
            </DialogTitle>
            <DialogDescription>
              Créer une réclamation pour cette expédition
            </DialogDescription>
          </DialogHeader>
          {selectedShipmentForClaim && (
            <div className="space-y-4 py-4">
              {/* Shipment Info Summary */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Référence</span>
                  <span className="font-mono font-medium">{selectedShipmentForClaim.order_ref || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tracking</span>
                  <span className="font-mono">{selectedShipmentForClaim.tracking || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transporteur</span>
                  <Badge variant="muted">{selectedShipmentForClaim.carrier}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destinataire</span>
                  <span>{selectedShipmentForClaim.recipient_name || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date expédition</span>
                  <span>{selectedShipmentForClaim.shipped_at ? new Date(selectedShipmentForClaim.shipped_at).toLocaleDateString('fr-FR') : '-'}</span>
                </div>
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description du problème</label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Décrivez le problème rencontré (colis endommagé, non reçu, contenu manquant...)"
                  value={claimDescription}
                  onChange={(e) => setClaimDescription(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateClaim}
              disabled={createClaimMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {createClaimMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer la réclamation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Shipment Dialog */}
      <CreateShipmentDialog open={createShipmentOpen} onOpenChange={setCreateShipmentOpen} />
    </div>
  )
}

function ExpeditionsLoadingSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-7 lg:h-8 w-36 lg:w-48" />
          <Skeleton className="h-4 w-28 lg:w-32" />
        </div>
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
