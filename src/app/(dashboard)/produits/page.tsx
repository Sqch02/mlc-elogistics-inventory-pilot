'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/tables/DataTable'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { format } from 'date-fns'

interface SKUMetrics {
  sku_id: string
  sku_code: string
  name: string
  qty_current: number
  consumption_30d: number
  consumption_90d: number
  avg_daily_90d: number
  days_remaining: number | null
  pending_restock: number
  projected_stock: number
}

const columns: ColumnDef<SKUMetrics>[] = [
  {
    accessorKey: 'sku_code',
    header: 'Code SKU',
  },
  {
    accessorKey: 'name',
    header: 'Nom',
  },
  {
    accessorKey: 'qty_current',
    header: 'Stock actuel',
    cell: ({ row }) => row.original.qty_current,
  },
  {
    accessorKey: 'consumption_30d',
    header: 'Conso. 30j',
    cell: ({ row }) => row.original.consumption_30d,
  },
  {
    accessorKey: 'avg_daily_90d',
    header: 'Moy./jour',
    cell: ({ row }) => row.original.avg_daily_90d.toFixed(2),
  },
  {
    accessorKey: 'days_remaining',
    header: 'Jours restants',
    cell: ({ row }) => {
      const days = row.original.days_remaining
      if (days === null) return '-'
      return (
        <Badge variant={days < 7 ? 'destructive' : days < 14 ? 'secondary' : 'default'}>
          {days} j
        </Badge>
      )
    },
  },
  {
    accessorKey: 'pending_restock',
    header: 'Reassort',
    cell: ({ row }) =>
      row.original.pending_restock > 0 ? `+${row.original.pending_restock}` : '-',
  },
  {
    accessorKey: 'projected_stock',
    header: 'Stock proj.',
    cell: ({ row }) => row.original.projected_stock,
  },
]

export default function ProduitsPage() {
  const [metrics, setMetrics] = useState<SKUMetrics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  async function fetchMetrics() {
    try {
      const response = await fetch('/api/stock')
      const data = await response.json()
      setMetrics(data.metrics || [])
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    const csv = generateCSV(
      metrics.map((m) => ({
        sku_code: m.sku_code,
        name: m.name,
        qty_current: m.qty_current,
        consumption_30d: m.consumption_30d,
        consumption_90d: m.consumption_90d,
        avg_daily_90d: m.avg_daily_90d,
        days_remaining: m.days_remaining ?? '',
        pending_restock: m.pending_restock,
        projected_stock: m.projected_stock,
      }))
    )
    downloadCSV(csv, `stock_${format(new Date(), 'yyyy-MM-dd')}.csv`)
  }

  if (loading) {
    return <div className="p-4">Chargement...</div>
  }

  const criticalCount = metrics.filter(
    (m) => m.days_remaining !== null && m.days_remaining < 7
  ).length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Produits & Stock</h1>
          <p className="text-muted-foreground">
            Suivi du stock et des metriques de consommation
          </p>
        </div>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="text-sm">
            {criticalCount} SKU(s) en stock critique
          </Badge>
        )}
      </div>

      <DataTable
        columns={columns}
        data={metrics}
        searchKey="sku_code"
        searchPlaceholder="Rechercher par code SKU..."
        onExport={handleExport}
      />
    </div>
  )
}
