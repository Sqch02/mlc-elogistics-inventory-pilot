'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DataTable } from '@/components/tables/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Plus, Settings, Building2, MapPin, Users } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Tenant {
  id: string
  name: string
  code: string | null
  city: string | null
  is_active: boolean
  created_at: string
  user_count: number
  sync_enabled: boolean
}

type StatusFilter = 'all' | 'active' | 'inactive'

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    fetchTenants()
  }, [])

  async function fetchTenants() {
    try {
      const response = await fetch('/api/admin/tenants')
      const data = await response.json()
      setTenants(data.tenants || [])
    } catch (error) {
      console.error('Error fetching tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          code: newCode || undefined,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setCreateOpen(false)
        setNewName('')
        setNewCode('')
        fetchTenants()
      } else if (data.error) {
        alert(data.error)
      }
    } catch (error) {
      console.error('Error creating tenant:', error)
    } finally {
      setCreating(false)
    }
  }

  // Filter tenants by status
  const filteredTenants = tenants.filter((tenant) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'active') return tenant.is_active !== false
    if (statusFilter === 'inactive') return tenant.is_active === false
    return true
  })

  // Count by status
  const activeCounts = {
    all: tenants.length,
    active: tenants.filter((t) => t.is_active !== false).length,
    inactive: tenants.filter((t) => t.is_active === false).length,
  }

  const columns: ColumnDef<Tenant>[] = [
    {
      accessorKey: 'name',
      header: 'Client',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium flex items-center gap-2">
              {row.original.name}
              {row.original.is_active === false && (
                <Badge variant="destructive" className="text-xs">
                  Inactif
                </Badge>
              )}
            </div>
            {row.original.code && (
              <div className="text-xs text-muted-foreground font-mono">
                {row.original.code}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'city',
      header: 'Ville',
      cell: ({ row }) =>
        row.original.city ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {row.original.city}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: 'users',
      header: 'Utilisateurs',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Badge variant="secondary">{row.original.user_count}</Badge>
        </div>
      ),
    },
    {
      id: 'sync',
      header: 'Sendcloud',
      cell: ({ row }) => (
        <Badge variant={row.original.sync_enabled ? 'default' : 'secondary'}>
          {row.original.sync_enabled ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Cree le',
      cell: ({ row }) =>
        format(new Date(row.original.created_at), 'dd/MM/yyyy', { locale: fr }),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link href={`/admin/tenants/${row.original.id}`}>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurer
          </Button>
        </Link>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">
            Gestion des clients multi-tenant
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau client</DialogTitle>
              <DialogDescription>
                Creer un nouveau client dans le systeme
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du client *</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: ACME LOGISTICS"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code client</Label>
                <Input
                  id="code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="Ex: ACME (auto-genere si vide)"
                  maxLength={8}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Code unique pour references et exports (max 8 caracteres)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? 'Creation...' : 'Creer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          Tous ({activeCounts.all})
        </Button>
        <Button
          variant={statusFilter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('active')}
        >
          Actifs ({activeCounts.active})
        </Button>
        <Button
          variant={statusFilter === 'inactive' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('inactive')}
        >
          Inactifs ({activeCounts.inactive})
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredTenants}
        searchKey="name"
        searchPlaceholder="Rechercher un client..."
      />
    </div>
  )
}
