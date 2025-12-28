'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search } from 'lucide-react'

interface Location {
  id: string
  code: string
  label: string | null
  active: boolean
  assignment?: {
    sku: { sku_code: string; name: string }
  } | null
}

const columns: ColumnDef<Location>[] = [
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => (
      <span className="font-mono font-medium">{row.original.code}</span>
    ),
  },
  {
    accessorKey: 'label',
    header: 'Description',
    cell: ({ row }) => row.original.label || '-',
  },
  {
    accessorKey: 'active',
    header: 'Statut',
    cell: ({ row }) => (
      <Badge variant={row.original.active ? 'default' : 'secondary'}>
        {row.original.active ? 'Actif' : 'Inactif'}
      </Badge>
    ),
  },
  {
    id: 'sku',
    header: 'SKU assigne',
    cell: ({ row }) => {
      const assignment = row.original.assignment
      if (!assignment?.sku) return <span className="text-muted-foreground">-</span>
      return (
        <div>
          <Badge variant="outline">{assignment.sku.sku_code}</Badge>
          <span className="ml-2 text-sm text-muted-foreground">
            {assignment.sku.name}
          </span>
        </div>
      )
    },
  },
]

export default function EmplacementsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [skuSearch, setSkuSearch] = useState('')
  const [foundLocation, setFoundLocation] = useState<Location | null>(null)

  useEffect(() => {
    fetchLocations()
  }, [])

  async function fetchLocations() {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      setLocations(data.locations || [])
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleSkuSearch(value: string) {
    setSkuSearch(value)
    if (value.length > 0) {
      const found = locations.find((loc) =>
        loc.assignment?.sku?.sku_code?.toLowerCase().includes(value.toLowerCase())
      )
      setFoundLocation(found || null)
    } else {
      setFoundLocation(null)
    }
  }

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Emplacements</h1>
        <p className="text-muted-foreground">
          Gestion des emplacements de stockage (1 SKU par emplacement)
        </p>
      </div>

      {/* SKU Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recherche SKU → Emplacement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Entrez un code SKU..."
                value={skuSearch}
                onChange={(e) => handleSkuSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {skuSearch && (
              <div className="flex-1">
                {foundLocation ? (
                  <div className="p-3 bg-green-50 rounded-md">
                    <p className="text-sm font-medium text-green-800">
                      SKU trouve a l emplacement: <span className="font-mono">{foundLocation.code}</span>
                    </p>
                    {foundLocation.label && (
                      <p className="text-sm text-green-600">{foundLocation.label}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 rounded-md">
                    <p className="text-sm text-yellow-800">
                      SKU non trouve dans les emplacements
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={locations}
        searchKey="code"
        searchPlaceholder="Rechercher par code emplacement..."
      />
    </div>
  )
}
