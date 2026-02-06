'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X, Download, Loader2 } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { useTenant } from '@/components/providers/TenantProvider'

interface ProduitsFiltersProps {
  currentFilters: {
    search?: string
    status?: string
  }
}

export function ProduitsFilters({ currentFilters }: ProduitsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentFilters.search || '')
  const [isExporting, setIsExporting] = useState(false)
  const { isClient } = useTenant()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      const response = await fetch(`/api/stock?${params.toString()}`)
      const { skus } = await response.json()

      const exportData = skus.map((s: Record<string, unknown>) => {
        const base: Record<string, unknown> = {
          sku_code: s.sku_code || '',
          nom: s.name || '',
          description: s.description || '',
        }
        if (!isClient) {
          base.cout_unitaire_eur = s.unit_cost_eur || ''
        }
        base.stock_actuel = s.qty_current || 0
        base.seuil_alerte = s.alert_threshold || 0
        base.consommation_30j = s.consumption_30d || 0
        base.statut = s.status || ''
        return base
      })

      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `produits_${new Date().toISOString().split('T')[0]}.csv`)
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const updateFilters = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => {
      router.push(`/produits?${params.toString()}`)
    })
  }

  const handleSearch = () => {
    updateFilters('search', search || null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const clearFilters = () => {
    setSearch('')
    startTransition(() => {
      router.push('/produits')
    })
  }

  const hasFilters = currentFilters.search || currentFilters.status

  return (
    <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher (SKU, nom)..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSearch}
        />
      </div>

      {/* Status Filter */}
      <Select
        value={currentFilters.status || 'all'}
        onValueChange={(value) => updateFilters('status', value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Statut stock" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous statuts</SelectItem>
          <SelectItem value="ok">En stock</SelectItem>
          <SelectItem value="warning">Faible</SelectItem>
          <SelectItem value="critical">Critique</SelectItem>
          <SelectItem value="rupture">Rupture</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} disabled={isPending}>
          <X className="h-4 w-4 mr-1" />
          Effacer
        </Button>
      )}

      {/* Export Button */}
      <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
        {isExporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export CSV
      </Button>

      {isPending && (
        <span className="text-xs text-muted-foreground">Chargement...</span>
      )}
    </div>
  )
}
