'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'

interface Shipment {
  id: string
  sendcloud_id: string
  shipped_at: string
  carrier: string
  service: string | null
  weight_grams: number
  order_ref: string | null
  tracking: string | null
  pricing_status: 'ok' | 'missing'
  computed_cost_eur: number | null
}

const columns: ColumnDef<Shipment>[] = [
  {
    accessorKey: 'sendcloud_id',
    header: 'ID Sendcloud',
  },
  {
    accessorKey: 'shipped_at',
    header: 'Date',
    cell: ({ row }) => format(new Date(row.original.shipped_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
  },
  {
    accessorKey: 'carrier',
    header: 'Transporteur',
  },
  {
    accessorKey: 'order_ref',
    header: 'Ref. commande',
  },
  {
    accessorKey: 'weight_grams',
    header: 'Poids (g)',
    cell: ({ row }) => `${row.original.weight_grams} g`,
  },
  {
    accessorKey: 'pricing_status',
    header: 'Tarif',
    cell: ({ row }) => (
      <Badge variant={row.original.pricing_status === 'ok' ? 'default' : 'destructive'}>
        {row.original.pricing_status === 'ok' ? 'OK' : 'Manquant'}
      </Badge>
    ),
  },
  {
    accessorKey: 'computed_cost_eur',
    header: 'Cout',
    cell: ({ row }) =>
      row.original.computed_cost_eur
        ? `${row.original.computed_cost_eur.toFixed(2)} EUR`
        : '-',
  },
]

export default function ExpeditionsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchShipments()
  }, [])

  async function fetchShipments() {
    try {
      const response = await fetch('/api/shipments')
      const data = await response.json()
      setShipments(data.shipments || [])
    } catch (error) {
      console.error('Error fetching shipments:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    const csv = generateCSV(
      shipments.map((s) => ({
        sendcloud_id: s.sendcloud_id,
        date: format(new Date(s.shipped_at), 'yyyy-MM-dd HH:mm'),
        carrier: s.carrier,
        service: s.service || '',
        order_ref: s.order_ref || '',
        weight_grams: s.weight_grams,
        pricing_status: s.pricing_status,
        cost_eur: s.computed_cost_eur || '',
      }))
    )
    downloadCSV(csv, `expeditions_${format(new Date(), 'yyyy-MM-dd')}.csv`)
  }

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Expeditions</h1>
        <p className="text-muted-foreground">
          Liste des expeditions synchronisees depuis Sendcloud
        </p>
      </div>

      <DataTable
        columns={columns}
        data={shipments}
        searchKey="sendcloud_id"
        searchPlaceholder="Rechercher par ID Sendcloud..."
        onExport={handleExport}
      />
    </div>
  )
}
