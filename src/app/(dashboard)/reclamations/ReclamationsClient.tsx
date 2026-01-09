'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, MessageSquare, AlertTriangle, CheckCircle, Clock, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClaims, useCreateClaim, useUpdateClaimStatus, Claim } from '@/hooks/useClaims'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newClaim, setNewClaim] = useState({ order_ref: '', description: '' })

  const { data, isLoading, isFetching } = useClaims()
  const createMutation = useCreateClaim()
  const updateStatusMutation = useUpdateClaimStatus()

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

  const handleCreate = () => {
    createMutation.mutate(newClaim, {
      onSuccess: () => {
        setDialogOpen(false)
        setNewClaim({ order_ref: '', description: '' })
      }
    })
  }

  const handleUpdateStatus = (id: string, newStatus: string) => {
    updateStatusMutation.mutate({ id, status: newStatus })
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle reclamation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="order_ref">Reference commande</Label>
                  <Input
                    id="order_ref"
                    value={newClaim.order_ref}
                    onChange={(e) => setNewClaim(prev => ({ ...prev, order_ref: e.target.value }))}
                    placeholder="REF-123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newClaim.description}
                    onChange={(e) => setNewClaim(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Decrivez le probleme..."
                    rows={4}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Creer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
            <p className="text-xs mt-1">Creez un ticket pour signaler un probleme</p>
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
                        onValueChange={(value) => handleUpdateStatus(claim.id, value)}
                        disabled={updateStatusMutation.isPending}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
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
