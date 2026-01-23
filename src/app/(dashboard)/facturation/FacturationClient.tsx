'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FileText, Receipt, Euro, AlertTriangle, CheckCircle, Loader2, MoreHorizontal, Download, Trash2, Send, CreditCard, FileDown, ChevronDown, ChevronUp, Package, Truck, Fuel, RotateCcw, Cpu, Warehouse, Calculator } from 'lucide-react'
import { useInvoices, useGenerateInvoice, useUpdateInvoiceStatus, useDeleteInvoice, Invoice } from '@/hooks/useInvoices'
import { Skeleton } from '@/components/ui/skeleton'
import { ExportInvoicesButton, AccountingExportButton } from './FacturationActions'
import { generateCSV, downloadCSV } from '@/lib/utils/csv'
import { downloadInvoicePDF, formatInvoiceNumber, type InvoicePDFData } from '@/lib/utils/invoice-pdf'
import { toast } from 'sonner'

interface CompanySettings {
  company_name: string
  company_address: string
  company_city: string
  company_postal_code: string
  company_country: string
  company_vat_number: string
  company_siret: string
  company_email: string
  company_phone: string
  invoice_payment_terms: string
  invoice_bank_details: string
  invoice_prefix: string
  invoice_next_number: number
}

function formatMonth(month: string) {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

// Line type icons and labels
const lineTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  software: { icon: Cpu, label: 'Logiciel', color: 'text-blue-600 bg-blue-100' },
  storage: { icon: Warehouse, label: 'Stockage', color: 'text-purple-600 bg-purple-100' },
  reception: { icon: Package, label: 'Réception', color: 'text-indigo-600 bg-indigo-100' },
  shipping: { icon: Truck, label: 'Expédition', color: 'text-green-600 bg-green-100' },
  fuel_surcharge: { icon: Fuel, label: 'Carburant', color: 'text-amber-600 bg-amber-100' },
  returns: { icon: RotateCcw, label: 'Retours', color: 'text-gray-600 bg-gray-100' },
}

type InvoiceStatus = 'all' | 'draft' | 'sent' | 'paid'

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  all: 'Toutes',
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
}

export function FacturationClient() {
  const [selectedMonth, setSelectedMonth] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set())

  const { data, isLoading, isFetching } = useInvoices()

  // Load company settings for PDF generation
  useEffect(() => {
    fetch('/api/settings/company')
      .then(res => res.json())
      .then(data => setCompanySettings(data))
      .catch(() => {})
  }, [])
  const generateMutation = useGenerateInvoice()
  const updateStatusMutation = useUpdateInvoiceStatus()
  const deleteMutation = useDeleteInvoice()

  const allInvoices = data?.invoices || []
  const invoices = statusFilter === 'all'
    ? allInvoices
    : allInvoices.filter(inv => inv.status === statusFilter)
  const stats = data?.stats || {
    currentMonth: new Date().toISOString().slice(0, 7),
    currentMonthTotal: 0,
    currentMonthCount: 0,
    avgCostPerShipment: 0,
    missingPricing: 0,
    totalPaid: 0,
    totalPending: 0,
  }

  // Generate last 12 months options (use Set to ensure uniqueness)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setDate(1) // Set to first of month to avoid day overflow
    date.setMonth(date.getMonth() - i)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    return { value, label }
  }).filter((opt, index, self) =>
    index === self.findIndex(o => o.value === opt.value)
  )

  const handleGenerate = () => {
    if (selectedMonth) {
      generateMutation.mutate(selectedMonth)
    }
  }

  const handleUpdateStatus = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status })
  }

  const handleDelete = (invoice: Invoice) => {
    setInvoiceToDelete(invoice)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (invoiceToDelete) {
      await deleteMutation.mutateAsync(invoiceToDelete.id)
      setDeleteDialogOpen(false)
      setInvoiceToDelete(null)
    }
  }

  const handleDownloadCSV = (invoice: Invoice) => {
    type ExportRow = {
      periode: string
      type: string
      description: string
      transporteur: string
      poids_min_g: number | string
      poids_max_g: number | string
      quantite: number | string
      prix_unitaire_eur: number | string
      total_eur: number
    }

    const exportData: ExportRow[] = invoice.invoice_lines.map(line => ({
      periode: invoice.month,
      type: line.line_type || 'shipping',
      description: line.description || '',
      transporteur: line.carrier || '',
      poids_min_g: line.weight_min_grams || '',
      poids_max_g: line.weight_max_grams || '',
      quantite: line.quantity || line.shipment_count || 1,
      prix_unitaire_eur: line.unit_price_eur || '',
      total_eur: line.total_eur,
    }))

    // Add summary row
    exportData.push({
      periode: invoice.month,
      type: 'TOTAL',
      description: `Total ${invoice.invoice_lines.reduce((sum, l) => sum + l.shipment_count, 0)} expéditions`,
      transporteur: '',
      poids_min_g: '',
      poids_max_g: '',
      quantite: '',
      prix_unitaire_eur: '',
      total_eur: invoice.total_eur,
    })

    const csv = generateCSV(exportData, { delimiter: ';' })
    downloadCSV(csv, `facture_${invoice.month}.csv`)
  }

  const toggleExpanded = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId)
      } else {
        newSet.add(invoiceId)
      }
      return newSet
    })
  }

  const handleAccountingExport = async (invoice: Invoice, format: 'fec' | 'sage') => {
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/export?format=${format}`)

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Erreur lors de l\'export')
        return
      }

      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = format === 'fec' ? `FEC_${invoice.month}.txt` : `Sage_${invoice.month}.csv`

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Export ${format.toUpperCase()} téléchargé`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Erreur lors de l\'export')
    }
  }

  const handleDownloadPDF = (invoice: Invoice) => {
    if (!companySettings || !companySettings.company_name) {
      toast.error('Veuillez configurer les informations société dans Paramètres > Société')
      return
    }

    const year = parseInt(invoice.month.split('-')[0])
    // Generate invoice number based on order in list or use a simple counter
    const invoiceIndex = invoices.findIndex(inv => inv.id === invoice.id) + 1
    const invoiceNumber = formatInvoiceNumber(
      companySettings.invoice_prefix || 'FAC',
      year,
      invoiceIndex
    )

    const totalHT = Number(invoice.total_eur)
    const tvaRate = 20
    const tva = totalHT * (tvaRate / 100)
    const totalTTC = totalHT + tva

    const pdfData: InvoicePDFData = {
      invoiceNumber,
      month: invoice.month,
      createdAt: invoice.created_at,
      company: {
        name: companySettings.company_name,
        address: companySettings.company_address,
        city: companySettings.company_city,
        postalCode: companySettings.company_postal_code,
        country: companySettings.company_country,
        vatNumber: companySettings.company_vat_number,
        siret: companySettings.company_siret,
        email: companySettings.company_email,
        phone: companySettings.company_phone,
      },
      lines: invoice.invoice_lines.map(line => ({
        lineType: line.line_type,
        description: line.description || undefined,
        carrier: line.carrier,
        weightMin: line.weight_min_grams,
        weightMax: line.weight_max_grams,
        quantity: line.quantity || undefined,
        shipmentCount: line.shipment_count,
        unitPrice: Number(line.unit_price_eur) || (line.shipment_count > 0 ? Number(line.total_eur) / line.shipment_count : Number(line.total_eur)),
        total: Number(line.total_eur),
      })),
      totalHT,
      tvaRate,
      tva,
      totalTTC,
      paymentTerms: companySettings.invoice_payment_terms,
      bankDetails: companySettings.invoice_bank_details,
      missingPricingCount: invoice.missing_pricing_count,
    }

    downloadInvoicePDF(pdfData, `facture_${invoiceNumber}.pdf`)
    toast.success('PDF téléchargé')
  }

  if (isLoading) {
    return <FacturationLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Facturation</h1>
          <p className="text-muted-foreground text-sm">
            {invoices.length} facture(s) {statusFilter !== 'all' && `(${STATUS_LABELS[statusFilter].toLowerCase()})`} {isFetching && '(chargement...)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportInvoicesButton />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Choisir un mois" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerate}
            disabled={!selectedMonth || generateMutation.isPending}
          >
            {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Générer
          </Button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Statut:</span>
        {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((status) => {
          const count = status === 'all'
            ? allInvoices.length
            : allInvoices.filter(inv => inv.status === status).length
          return (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStatusFilter(status)}
            >
              {STATUS_LABELS[status]}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === status ? 'bg-white/20' : 'bg-muted'}`}>
                {count}
              </span>
            </Button>
          )
        })}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Factures</p>
              <p className="text-lg lg:text-2xl font-bold">{allInvoices.length}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <Receipt className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Expéditions</p>
              <p className="text-lg lg:text-2xl font-bold text-blue-600">{stats.currentMonthCount}</p>
              <p className="text-[9px] text-muted-foreground">ce mois</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-blue-100 rounded-lg text-blue-600">
              <Truck className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Coût moyen</p>
              <p className="text-lg lg:text-2xl font-bold text-purple-600">{stats.avgCostPerShipment.toFixed(2)} €</p>
              <p className="text-[9px] text-muted-foreground">par expédition</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-purple-100 rounded-lg text-purple-600">
              <Calculator className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Total payé</p>
              <p className="text-lg lg:text-2xl font-bold text-green-600">{stats.totalPaid.toFixed(2)} €</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-green-100 rounded-lg text-green-600">
              <CheckCircle className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">En attente</p>
              <p className="text-lg lg:text-2xl font-bold text-amber-600">{stats.totalPending.toFixed(2)} €</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-amber-100 rounded-lg text-amber-600">
              <Euro className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Tarifs manquants</p>
              <p className="text-lg lg:text-2xl font-bold">{stats.missingPricing}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-gray-100 rounded-lg text-gray-600">
              <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Aucune facture générée</p>
            <p className="text-xs mt-1">Sélectionnez un mois et cliquez sur Générer</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 lg:pl-6 whitespace-nowrap w-8"></TableHead>
                  <TableHead className="whitespace-nowrap">Periode</TableHead>
                  <TableHead className="hidden sm:table-cell whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Total HT</TableHead>
                  <TableHead className="text-right whitespace-nowrap hidden md:table-cell">TVA 20%</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Total TTC</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
                  <TableHead className="text-right pr-4 lg:pr-6 whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const isExpanded = expandedInvoices.has(inv.id)
                  const shipmentCount = inv.invoice_lines.filter(l => l.line_type === 'shipping').reduce((sum, l) => sum + l.shipment_count, 0)
                  // Use new fields if available, otherwise calculate from total_eur
                  const subtotalHt = inv.subtotal_ht ? Number(inv.subtotal_ht) : Number(inv.total_eur)
                  const vatAmount = inv.vat_amount ? Number(inv.vat_amount) : subtotalHt * 0.20
                  const totalTtc = inv.total_ttc ? Number(inv.total_ttc) : subtotalHt * 1.20

                  // Group lines by type
                  const linesByType = inv.invoice_lines.reduce((acc, line) => {
                    const type = line.line_type || 'shipping'
                    if (!acc[type]) acc[type] = []
                    acc[type].push(line)
                    return acc
                  }, {} as Record<string, typeof inv.invoice_lines>)

                  return (
                    <>
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpanded(inv.id)}>
                        <TableCell className="pl-4 lg:pl-6 w-8">
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatMonth(inv.month)}
                          {shipmentCount > 0 && (
                            <span className="text-muted-foreground text-xs ml-2">({shipmentCount} exp.)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{formatDate(inv.created_at)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">{subtotalHt.toFixed(2)} €</TableCell>
                        <TableCell className="text-right whitespace-nowrap text-muted-foreground hidden md:table-cell">{vatAmount.toFixed(2)} €</TableCell>
                        <TableCell className="text-right font-bold whitespace-nowrap text-primary">{totalTtc.toFixed(2)} €</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'sent' ? 'info' : 'secondary'} className="text-xs">
                            {inv.status === 'sent' ? 'Envoyée' : inv.status === 'paid' ? 'Payée' : 'Brouillon'}
                          </Badge>
                          {inv.missing_pricing_count > 0 && (
                            <Badge variant="warning" className="text-xs ml-1">
                              {inv.missing_pricing_count} manq.
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4 lg:pr-6" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadPDF(inv)}>
                              <FileDown className="mr-2 h-4 w-4" />
                              Telecharger PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadCSV(inv)}>
                              <Download className="mr-2 h-4 w-4" />
                              Telecharger CSV
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleAccountingExport(inv, 'fec')}>
                              <Calculator className="mr-2 h-4 w-4" />
                              Export FEC (Fiscal)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAccountingExport(inv, 'sage')}>
                              <Calculator className="mr-2 h-4 w-4" />
                              Export Sage CSV
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {inv.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(inv.id, 'sent')}>
                                <Send className="mr-2 h-4 w-4" />
                                Marquer envoyée
                              </DropdownMenuItem>
                            )}
                            {inv.status === 'sent' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(inv.id, 'paid')}>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Marquer payée
                              </DropdownMenuItem>
                            )}
                            {inv.status !== 'draft' && inv.status !== 'paid' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(inv.id, 'draft')}>
                                <FileText className="mr-2 h-4 w-4" />
                                Remettre en brouillon
                              </DropdownMenuItem>
                            )}
                            {inv.status === 'draft' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDelete(inv)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail rows */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-4 space-y-4">
                              {/* Line types summary */}
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {Object.entries(linesByType).map(([type, lines]) => {
                                  const config = lineTypeConfig[type] || { icon: FileText, label: type, color: 'text-gray-600 bg-gray-100' }
                                  const Icon = config.icon
                                  const typeTotal = lines.reduce((sum, l) => sum + Number(l.total_eur), 0)
                                  return (
                                    <div key={type} className="flex items-center gap-2 p-2 rounded-lg bg-background border">
                                      <div className={`p-1.5 rounded ${config.color}`}>
                                        <Icon className="h-3.5 w-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground truncate">{config.label}</p>
                                        <p className="text-sm font-semibold">{typeTotal.toFixed(2)} €</p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Detailed lines table */}
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/50">
                                      <TableHead className="text-xs">Type</TableHead>
                                      <TableHead className="text-xs">Description</TableHead>
                                      <TableHead className="text-xs text-right">Qté</TableHead>
                                      <TableHead className="text-xs text-right">Prix unit.</TableHead>
                                      <TableHead className="text-xs text-right">Total HT</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {inv.invoice_lines.map((line, idx) => {
                                      const config = lineTypeConfig[line.line_type || 'shipping'] || { icon: FileText, label: line.line_type, color: 'text-gray-600 bg-gray-100' }
                                      const Icon = config.icon
                                      return (
                                        <TableRow key={idx} className="text-sm">
                                          <TableCell className="py-2">
                                            <div className="flex items-center gap-1.5">
                                              <div className={`p-1 rounded ${config.color}`}>
                                                <Icon className="h-3 w-3" />
                                              </div>
                                              <span className="text-xs">{config.label}</span>
                                            </div>
                                          </TableCell>
                                          <TableCell className="py-2 text-xs text-muted-foreground max-w-[300px] truncate">
                                            {line.description || (line.carrier ? `${line.carrier} ${line.weight_min_grams}-${line.weight_max_grams}g` : '-')}
                                          </TableCell>
                                          <TableCell className="py-2 text-xs text-right">
                                            {line.quantity || line.shipment_count || 1}
                                          </TableCell>
                                          <TableCell className="py-2 text-xs text-right">
                                            {Number(line.unit_price_eur || 0).toFixed(2)} €
                                          </TableCell>
                                          <TableCell className="py-2 text-xs text-right font-medium">
                                            {Number(line.total_eur).toFixed(2)} €
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                    {/* Totals */}
                                    <TableRow className="bg-muted/30 font-medium">
                                      <TableCell colSpan={4} className="py-2 text-right text-xs">Total HT</TableCell>
                                      <TableCell className="py-2 text-right text-xs">{subtotalHt.toFixed(2)} €</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-muted/30">
                                      <TableCell colSpan={4} className="py-2 text-right text-xs text-muted-foreground">TVA 20%</TableCell>
                                      <TableCell className="py-2 text-right text-xs text-muted-foreground">{vatAmount.toFixed(2)} €</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-primary/5 font-bold">
                                      <TableCell colSpan={4} className="py-2 text-right text-sm">Total TTC</TableCell>
                                      <TableCell className="py-2 text-right text-sm text-primary">{totalTtc.toFixed(2)} €</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la facture</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la facture de {invoiceToDelete ? formatMonth(invoiceToDelete.month) : ''} ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FacturationLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-24" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
