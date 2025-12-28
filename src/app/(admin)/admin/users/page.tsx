'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface User {
  id: string
  email: string
  role: string
  tenant_id: string
  tenant_name: string
  created_at: string
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  ops: 'Operations',
  sav: 'SAV',
}

const roleColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  super_admin: 'destructive',
  admin: 'default',
  ops: 'secondary',
  sav: 'secondary',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant={roleColors[row.original.role] || 'secondary'}>
          {roleLabels[row.original.role] || row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'tenant_name',
      header: 'Tenant',
      cell: ({ row }) => row.original.tenant_name || '-',
    },
    {
      accessorKey: 'created_at',
      header: 'Cree le',
      cell: ({ row }) =>
        row.original.created_at
          ? format(new Date(row.original.created_at), 'dd/MM/yyyy', { locale: fr })
          : '-',
    },
  ]

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="text-muted-foreground">
          Liste de tous les utilisateurs du systeme
        </p>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchKey="email"
        searchPlaceholder="Rechercher par email..."
      />
    </div>
  )
}
