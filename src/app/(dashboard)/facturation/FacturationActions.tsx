'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Loader2, Download, Calculator } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'

export function GenerateInvoiceButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Generate last 12 months options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    return { value, label }
  })

  const handleGenerate = async () => {
    if (!selectedMonth) {
      setError('Sélectionnez un mois')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.message || 'Erreur lors de la génération')
        return
      }

      router.refresh()
    } catch (err) {
      setError('Erreur de connexion')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Choisir un mois" />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="default"
        size="sm"
        onClick={handleGenerate}
        disabled={isLoading || !selectedMonth}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Générer
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

interface UpdateStatusButtonProps {
  invoiceId: string
  currentStatus: string
}

export function UpdateStatusButton({ invoiceId, currentStatus }: UpdateStatusButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const nextStatus = currentStatus === 'draft' ? 'sent' : currentStatus === 'sent' ? 'paid' : null

  if (!nextStatus) return null

  const handleUpdate = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleUpdate}
      disabled={isLoading}
      className="text-xs"
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : nextStatus === 'sent' ? (
        'Marquer envoyée'
      ) : (
        'Marquer payée'
      )}
    </Button>
  )
}

interface InvoiceLine {
  carrier: string
  weight_min_grams: number
  weight_max_grams: number
  shipment_count: number
  total_eur: number
  unit_price_eur: number | null
}

interface Invoice {
  id: string
  month: string
  total_eur: number
  missing_pricing_count: number
  status: string
  created_at: string
  invoice_lines: InvoiceLine[]
}

// Format weight bracket for display (e.g., "250g", "<500g", "1kg")
function formatWeightBracket(minGrams: number, maxGrams: number): string {
  if (maxGrams <= 250) return '250g'
  if (maxGrams <= 500) return '<500g'
  if (maxGrams <= 1000) return '<1kg'
  if (maxGrams <= 2000) return '<2kg'
  if (maxGrams <= 5000) return '<5kg'
  if (maxGrams <= 10000) return '<10kg'
  return `<${Math.round(maxGrams / 1000)}kg`
}

// Format carrier name for display
function formatCarrier(carrier: string): string {
  const normalized = carrier.toLowerCase()
  if (normalized.includes('relay') || normalized.includes('point')) return 'Relay'
  if (normalized.includes('domicile') || normalized.includes('home')) return 'Domicile'
  if (normalized.includes('colissimo')) return 'Colissimo'
  if (normalized.includes('chronopost')) return 'Chronopost'
  return carrier
}

// Format number with French locale (comma as decimal separator)
function formatEuro(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

export function ExportInvoicesButton() {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/invoices')
      const { invoices } = await response.json() as { invoices: Invoice[] }

      // Build detailed export with lines
      const exportLines: Record<string, string | number>[] = []
      const TVA_RATE = 0.20

      for (const inv of invoices) {
        // Add invoice header
        exportLines.push({
          type: '--- FACTURE ---',
          description: `Mois: ${inv.month}`,
          prix_unitaire_ht: '',
          quantite: '',
          tva_pct: '',
          total_ht: ''
        })

        let invoiceTotalHT = 0

        // Add each invoice line
        for (const line of inv.invoice_lines || []) {
          const unitPrice = line.unit_price_eur ?? (line.total_eur / line.shipment_count)
          const lineTotal = line.total_eur
          invoiceTotalHT += lineTotal

          exportLines.push({
            type: 'Prépa & Expédition',
            description: `${formatCarrier(line.carrier)} ${formatWeightBracket(line.weight_min_grams, line.weight_max_grams)}`,
            prix_unitaire_ht: formatEuro(unitPrice),
            quantite: line.shipment_count,
            tva_pct: '20%',
            total_ht: formatEuro(lineTotal)
          })
        }

        // Add totals
        const tvaAmount = invoiceTotalHT * TVA_RATE
        const totalTTC = invoiceTotalHT + tvaAmount

        exportLines.push({
          type: '',
          description: '',
          prix_unitaire_ht: '',
          quantite: '',
          tva_pct: '',
          total_ht: ''
        })
        exportLines.push({
          type: '',
          description: 'Total HT',
          prix_unitaire_ht: '',
          quantite: '',
          tva_pct: '',
          total_ht: formatEuro(invoiceTotalHT)
        })
        exportLines.push({
          type: '',
          description: 'TVA (20%)',
          prix_unitaire_ht: '',
          quantite: '',
          tva_pct: '',
          total_ht: formatEuro(tvaAmount)
        })
        exportLines.push({
          type: '',
          description: 'Total TTC',
          prix_unitaire_ht: '',
          quantite: '',
          tva_pct: '',
          total_ht: formatEuro(totalTTC)
        })

        // Add warning if missing pricing
        if (inv.missing_pricing_count > 0) {
          exportLines.push({
            type: '⚠️',
            description: `${inv.missing_pricing_count} expéditions sans tarif`,
            prix_unitaire_ht: '',
            quantite: '',
            tva_pct: '',
            total_ht: ''
          })
        }

        // Separator between invoices
        exportLines.push({
          type: '',
          description: '',
          prix_unitaire_ht: '',
          quantite: '',
          tva_pct: '',
          total_ht: ''
        })
      }

      const csv = generateCSV(exportLines, {
        headers: ['type', 'description', 'prix_unitaire_ht', 'quantite', 'tva_pct', 'total_ht'],
        delimiter: ';'
      })
      downloadCSV(csv, `factures_detaillees_${new Date().toISOString().split('T')[0]}.csv`)
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export détaillé
    </Button>
  )
}

interface AccountingExportButtonProps {
  invoiceId: string
  invoiceNumber: string
}

export function AccountingExportButton({ invoiceId, invoiceNumber }: AccountingExportButtonProps) {
  const [isExporting, setIsExporting] = useState<'fec' | 'sage' | null>(null)

  const handleExport = async (format: 'fec' | 'sage') => {
    setIsExporting(format)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/export?format=${format}`)

      if (!response.ok) {
        const error = await response.json()
        console.error('Export error:', error)
        return
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = format === 'fec' ? `FEC_${invoiceNumber}.txt` : `Sage_${invoiceNumber}.csv`

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      // Download file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!!isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Comptable</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('fec')}>
          <FileText className="mr-2 h-4 w-4" />
          FEC (Fiscal)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('sage')}>
          <Download className="mr-2 h-4 w-4" />
          Sage CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
