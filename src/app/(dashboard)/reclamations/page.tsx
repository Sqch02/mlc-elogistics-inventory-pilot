'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus } from 'lucide-react'

interface Claim {
  id: string
  order_ref: string | null
  opened_at: string
  status: 'ouverte' | 'en_analyse' | 'indemnisee' | 'refusee' | 'cloturee'
  description: string | null
  indemnity_eur: number | null
  decision_note: string | null
  decided_at: string | null
  shipments?: { sendcloud_id: string; carrier: string } | null
}

const statusLabels: Record<Claim['status'], string> = {
  ouverte: 'Ouverte',
  en_analyse: 'En analyse',
  indemnisee: 'Indemnisee',
  refusee: 'Refusee',
  cloturee: 'Cloturee',
}

const statusColors: Record<Claim['status'], 'default' | 'secondary' | 'destructive'> = {
  ouverte: 'default',
  en_analyse: 'secondary',
  indemnisee: 'default',
  refusee: 'destructive',
  cloturee: 'secondary',
}

export default function ReclamationsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  useEffect(() => {
    fetchClaims()
  }, [])

  async function fetchClaims() {
    try {
      const response = await fetch('/api/claims')
      const data = await response.json()
      setClaims(data.claims || [])
    } catch (error) {
      console.error('Error fetching claims:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateClaim(formData: FormData) {
    try {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ref: formData.get('order_ref') || null,
          description: formData.get('description') || null,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setCreateDialogOpen(false)
        fetchClaims()
      }
    } catch (error) {
      console.error('Error creating claim:', error)
    }
  }

  async function handleUpdateClaim(claimId: string, updates: Partial<Claim>) {
    try {
      const response = await fetch(`/api/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await response.json()
      if (data.success) {
        setSelectedClaim(null)
        fetchClaims()
      }
    } catch (error) {
      console.error('Error updating claim:', error)
    }
  }

  const columns: ColumnDef<Claim>[] = [
    {
      accessorKey: 'order_ref',
      header: 'Ref. commande',
      cell: ({ row }) => row.original.order_ref || '-',
    },
    {
      accessorKey: 'opened_at',
      header: 'Date ouverture',
      cell: ({ row }) =>
        format(new Date(row.original.opened_at), 'dd/MM/yyyy', { locale: fr }),
    },
    {
      accessorKey: 'status',
      header: 'Statut',
      cell: ({ row }) => (
        <Badge variant={statusColors[row.original.status]}>
          {statusLabels[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="truncate max-w-xs block">
          {row.original.description || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'indemnity_eur',
      header: 'Indemnite',
      cell: ({ row }) =>
        row.original.indemnity_eur
          ? `${row.original.indemnity_eur.toFixed(2)} EUR`
          : '-',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedClaim(row.original)}
        >
          Gerer
        </Button>
      ),
    },
  ]

  // Calculate monthly totals
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthlyIndemnified = claims
    .filter(
      (c) =>
        c.status === 'indemnisee' &&
        c.decided_at &&
        new Date(c.decided_at) >= startOfMonth
    )
    .reduce((sum, c) => sum + (c.indemnity_eur || 0), 0)

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Reclamations</h1>
          <p className="text-muted-foreground">
            Gestion des reclamations clients (SAV)
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle reclamation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCreateClaim(new FormData(e.currentTarget))
              }}
            >
              <DialogHeader>
                <DialogTitle>Nouvelle reclamation</DialogTitle>
                <DialogDescription>
                  Creer une nouvelle reclamation client
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="order_ref">Reference commande</Label>
                  <Input id="order_ref" name="order_ref" placeholder="ORD-XXX" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Decrivez le probleme..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Creer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Monthly KPI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Total indemnise ce mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{monthlyIndemnified.toFixed(2)} EUR</p>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={claims}
        searchKey="order_ref"
        searchPlaceholder="Rechercher par ref. commande..."
      />

      {/* Edit Dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerer la reclamation</DialogTitle>
            <DialogDescription>
              Ref: {selectedClaim?.order_ref || 'N/A'}
            </DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={selectedClaim.status}
                  onValueChange={(value) =>
                    handleUpdateClaim(selectedClaim.id, {
                      status: value as Claim['status'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="indemnity">Montant indemnisation (EUR)</Label>
                <div className="flex gap-2">
                  <Input
                    id="indemnity"
                    type="number"
                    step="0.01"
                    defaultValue={selectedClaim.indemnity_eur || ''}
                    placeholder="0.00"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('indemnity') as HTMLInputElement
                      handleUpdateClaim(selectedClaim.id, {
                        indemnity_eur: parseFloat(input.value) || null,
                        status: 'indemnisee',
                      })
                    }}
                  >
                    Indemniser
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="decision_note">Note de decision</Label>
                <Textarea
                  id="decision_note"
                  defaultValue={selectedClaim.decision_note || ''}
                  placeholder="Justification de la decision..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedClaim(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
