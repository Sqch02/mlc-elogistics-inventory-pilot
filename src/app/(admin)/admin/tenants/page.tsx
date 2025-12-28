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
import { Plus, Settings } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Tenant {
  id: string
  name: string
  created_at: string
  user_count: number
  sync_enabled: boolean
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

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
        body: JSON.stringify({ name: newName }),
      })
      const data = await response.json()
      if (data.success) {
        setCreateOpen(false)
        setNewName('')
        fetchTenants()
      }
    } catch (error) {
      console.error('Error creating tenant:', error)
    } finally {
      setCreating(false)
    }
  }

  const columns: ColumnDef<Tenant>[] = [
    {
      accessorKey: 'name',
      header: 'Nom',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Cree le',
      cell: ({ row }) =>
        format(new Date(row.original.created_at), 'dd/MM/yyyy', { locale: fr }),
    },
    {
      id: 'users',
      header: 'Utilisateurs',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.user_count}</Badge>
      ),
    },
    {
      id: 'sync',
      header: 'Sync Sendcloud',
      cell: ({ row }) => (
        <Badge variant={row.original.sync_enabled ? 'default' : 'secondary'}>
          {row.original.sync_enabled ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
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
    return <div className="p-4">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            Gestion des clients (multi-tenant)
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau tenant</DialogTitle>
              <DialogDescription>
                Creer un nouveau client dans le systeme
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du tenant</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Client ABC"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Creation...' : 'Creer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        searchKey="name"
        searchPlaceholder="Rechercher un tenant..."
      />
    </div>
  )
}
