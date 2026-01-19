'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X, Download, Loader2, Calendar } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { cn } from '@/lib/utils'

// Quick date presets
function getDatePresets() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Start of week (Monday)
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - diffToMonday)

  // Start of month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    today: { from: today, to: today },
    week: { from: startOfWeek.toISOString().split('T')[0], to: today },
    month: { from: startOfMonth.toISOString().split('T')[0], to: today },
  }
}

interface ExpeditionsFiltersProps {
  carriers: string[]
  currentFilters: {
    from?: string
    to?: string
    carrier?: string
    pricing_status?: string
    search?: string
  }
}

export function ExpeditionsFilters({ carriers, currentFilters }: ExpeditionsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentFilters.search || '')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      const response = await fetch(`/api/shipments?${params.toString()}`)
      const { shipments } = await response.json()

      const exportData = shipments.map((s: Record<string, unknown>) => ({
        date: s.shipped_at ? new Date(s.shipped_at as string).toLocaleDateString('fr-FR') : '',
        heure: s.shipped_at ? new Date(s.shipped_at as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        reference: s.order_ref || '',
        sendcloud_id: s.sendcloud_id || '',
        transporteur: s.carrier || '',
        service: s.service || '',
        statut: s.status_message || '',
        poids_g: s.weight_grams || 0,
        tracking: s.tracking_number || s.tracking || '',
        destinataire: s.recipient_name || '',
        ville: s.recipient_city || '',
        code_postal: s.recipient_postal || '',
        pays: s.recipient_country || '',
        cout_eur: s.computed_cost_eur ? Number(s.computed_cost_eur).toFixed(2) : '',
        valeur_declaree: s.total_value ? Number(s.total_value).toFixed(2) : '',
        statut_tarif: s.pricing_status === 'ok' ? 'OK' : 'Manquant',
        articles: Array.isArray(s.shipment_items)
          ? (s.shipment_items as Array<{ qty: number; skus: { sku_code: string } }>)
              .map(i => `${i.skus?.sku_code || '?'} x${i.qty}`)
              .join(', ')
          : ''
      }))

      const csv = generateCSV(exportData, { delimiter: ';' })
      downloadCSV(csv, `expeditions_${new Date().toISOString().split('T')[0]}.csv`)
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
      router.push(`/expeditions?${params.toString()}`)
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
      router.push('/expeditions')
    })
  }

  const hasFilters = currentFilters.from || currentFilters.to || currentFilters.carrier || currentFilters.pricing_status || currentFilters.search

  const presets = getDatePresets()

  const applyPreset = (preset: 'today' | 'week' | 'month') => {
    const { from, to } = presets[preset]
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', from)
    params.set('to', to)
    startTransition(() => {
      router.push(`/expeditions?${params.toString()}`)
    })
  }

  const isPresetActive = (preset: 'today' | 'week' | 'month') => {
    const { from, to } = presets[preset]
    return currentFilters.from === from && currentFilters.to === to
  }

  return (
    <div className="space-y-3">
      {/* Quick Filters */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground mr-2">Periode :</span>
        <Button
          variant={isPresetActive('today') ? 'default' : 'outline'}
          size="sm"
          onClick={() => applyPreset('today')}
          className={cn('h-8', isPresetActive('today') && 'bg-primary')}
        >
          Aujourd&apos;hui
        </Button>
        <Button
          variant={isPresetActive('week') ? 'default' : 'outline'}
          size="sm"
          onClick={() => applyPreset('week')}
          className={cn('h-8', isPresetActive('week') && 'bg-primary')}
        >
          Cette semaine
        </Button>
        <Button
          variant={isPresetActive('month') ? 'default' : 'outline'}
          size="sm"
          onClick={() => applyPreset('month')}
          className={cn('h-8', isPresetActive('month') && 'bg-primary')}
        >
          Ce mois
        </Button>
      </div>

      {/* Main Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher (ref, tracking)..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSearch}
        />
      </div>

      {/* Carrier Filter */}
      <Select
        value={currentFilters.carrier || 'all'}
        onValueChange={(value) => updateFilters('carrier', value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Transporteur" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous transporteurs</SelectItem>
          {carriers.map((carrier) => (
            <SelectItem key={carrier} value={carrier}>
              {carrier}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Pricing Status Filter */}
      <Select
        value={currentFilters.pricing_status || 'all'}
        onValueChange={(value) => updateFilters('pricing_status', value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Statut pricing" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous statuts</SelectItem>
          <SelectItem value="ok">OK</SelectItem>
          <SelectItem value="missing">Tarif manquant</SelectItem>
          <SelectItem value="error">Erreur</SelectItem>
        </SelectContent>
      </Select>

      {/* Date From */}
      <Input
        type="date"
        className="w-[150px]"
        value={currentFilters.from || ''}
        onChange={(e) => updateFilters('from', e.target.value || null)}
        placeholder="Du"
      />

      {/* Date To */}
      <Input
        type="date"
        className="w-[150px]"
        value={currentFilters.to || ''}
        onChange={(e) => updateFilters('to', e.target.value || null)}
        placeholder="Au"
      />

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
    </div>
  )
}
