'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, RefreshCw, AlertTriangle } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface InvoiceLine {
  carrier: string
  weight_min_grams: number
  weight_max_grams: number
  shipment_count: number
  total_eur: number
}

interface Invoice {
  id: string
  month: string
  status: 'draft' | 'validated'
  total_eur: number
  missing_pricing_count: number
  invoice_lines: InvoiceLine[]
}

export default function FacturationPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Generate last 12 months
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    fetchInvoice()
  }, [selectedMonth])

  async function fetchInvoice() {
    setLoading(true)
    try {
      const response = await fetch(`/api/invoices?month=${selectedMonth}`)
      const data = await response.json()
      setInvoice(data.invoices?.[0] || null)
    } catch (error) {
      console.error('Error fetching invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      })
      const data = await response.json()
      if (data.success) {
        fetchInvoice()
      } else {
        alert(data.message)
      }
    } catch (error) {
      console.error('Error generating invoice:', error)
    } finally {
      setGenerating(false)
    }
  }

  function handleExport() {
    if (!invoice) return

    const lines = invoice.invoice_lines.map((line) => ({
      carrier: line.carrier,
      weight_min_grams: line.weight_min_grams,
      weight_max_grams: line.weight_max_grams,
      shipment_count: line.shipment_count,
      total_eur: line.total_eur.toFixed(2),
    }))

    // Add summary row
    lines.push({
      carrier: 'TOTAL',
      weight_min_grams: 0,
      weight_max_grams: 0,
      shipment_count: invoice.invoice_lines.reduce((sum, l) => sum + l.shipment_count, 0),
      total_eur: invoice.total_eur.toFixed(2),
    })

    if (invoice.missing_pricing_count > 0) {
      lines.push({
        carrier: 'TARIFS MANQUANTS',
        weight_min_grams: 0,
        weight_max_grams: 0,
        shipment_count: invoice.missing_pricing_count,
        total_eur: '0.00',
      })
    }

    const csv = generateCSV(lines)
    downloadCSV(csv, `facture_${selectedMonth}.csv`)
  }

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-')
    const date = new Date(parseInt(year), parseInt(m) - 1)
    return format(date, 'MMMM yyyy', { locale: fr })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturation</h1>
        <p className="text-muted-foreground">
          Generation et export des factures mensuelles
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {formatMonth(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleGenerate} disabled={generating}>
          <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generation...' : 'Generer / Actualiser'}
        </Button>

        {invoice && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        )}
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : invoice ? (
        <div className="space-y-4">
          {invoice.missing_pricing_count > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {invoice.missing_pricing_count} expedition(s) sans tarif - non incluses dans le total.
                <a href="/pricing" className="underline ml-1">
                  Completer la grille tarifaire
                </a>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Facture {formatMonth(invoice.month)}</CardTitle>
                  <CardDescription>
                    Statut: <Badge variant={invoice.status === 'validated' ? 'default' : 'secondary'}>
                      {invoice.status === 'validated' ? 'Validee' : 'Brouillon'}
                    </Badge>
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{invoice.total_eur.toFixed(2)} EUR</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transporteur</TableHead>
                    <TableHead>Tranche poids</TableHead>
                    <TableHead className="text-right">Expeditions</TableHead>
                    <TableHead className="text-right">Total EUR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.invoice_lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{line.carrier}</TableCell>
                      <TableCell>
                        {line.weight_min_grams}g - {line.weight_max_grams}g
                      </TableCell>
                      <TableCell className="text-right">{line.shipment_count}</TableCell>
                      <TableCell className="text-right">{line.total_eur.toFixed(2)} EUR</TableCell>
                    </TableRow>
                  ))}
                  {invoice.missing_pricing_count > 0 && (
                    <TableRow className="bg-red-50">
                      <TableCell className="font-medium text-red-600">Tarifs manquants</TableCell>
                      <TableCell className="text-red-600">-</TableCell>
                      <TableCell className="text-right text-red-600">
                        {invoice.missing_pricing_count}
                      </TableCell>
                      <TableCell className="text-right text-red-600">-</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Aucune facture pour ce mois. Cliquez sur Generer pour en creer une.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
