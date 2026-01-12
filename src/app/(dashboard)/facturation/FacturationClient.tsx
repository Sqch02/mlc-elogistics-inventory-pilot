'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FileText, Receipt, Euro, AlertTriangle, CheckCircle, Loader2, MoreHorizontal, Download, Trash2, Send, CreditCard, FileDown } from 'lucide-react'
import { useInvoices, useGenerateInvoice, useUpdateInvoiceStatus, useDeleteInvoice, Invoice } from '@/hooks/useInvoices'
import { Skeleton } from '@/components/ui/skeleton'
import { ExportInvoicesButton } from './FacturationActions'
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

export function FacturationClient() {
  const [selectedMonth, setSelectedMonth] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)

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

  const invoices = data?.invoices || []
  const stats = data?.stats || {
    currentMonth: new Date().toISOString().slice(0, 7),
    currentMonthTotal: 0,
    currentMonthCount: 0,
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
      transporteur: string
      poids_min_g: number | string
      poids_max_g: number | string
      nb_expeditions: number
      prix_unitaire_eur: number | string
      total_eur: number
    }

    const exportData: ExportRow[] = invoice.invoice_lines.map(line => ({
      periode: invoice.month,
      transporteur: line.carrier,
      poids_min_g: line.weight_min_grams,
      poids_max_g: line.weight_max_grams,
      nb_expeditions: line.shipment_count,
      prix_unitaire_eur: line.unit_price_eur || '',
      total_eur: line.total_eur,
    }))

    // Add summary row
    exportData.push({
      periode: invoice.month,
      transporteur: 'TOTAL',
      poids_min_g: '',
      poids_max_g: '',
      nb_expeditions: invoice.invoice_lines.reduce((sum, l) => sum + l.shipment_count, 0),
      prix_unitaire_eur: '',
      total_eur: invoice.total_eur,
    })

    const csv = generateCSV(exportData, { delimiter: ';' })
    downloadCSV(csv, `facture_${invoice.month}.csv`)
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
        carrier: line.carrier,
        weightMin: line.weight_min_grams,
        weightMax: line.weight_max_grams,
        shipmentCount: line.shipment_count,
        unitPrice: Number(line.unit_price_eur) || Number(line.total_eur) / line.shipment_count,
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
            {invoices.length} facture(s) {isFetching && '(chargement...)'}
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

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Factures</p>
              <p className="text-lg lg:text-2xl font-bold">{invoices.length}</p>
            </div>
            <div className="p-1.5 lg:p-2 bg-primary/10 rounded-lg text-primary">
              <Receipt className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border">
          <CardContent className="p-3 lg:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium uppercase">Total payé</p>
              <p className="text-lg lg:text-2xl font-bold text-green-600">{stats.totalPaid.toFixed(2)} EUR</p>
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
              <p className="text-lg lg:text-2xl font-bold text-amber-600">{stats.totalPending.toFixed(2)} EUR</p>
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
                  <TableHead className="pl-4 lg:pl-6 whitespace-nowrap">Periode</TableHead>
                  <TableHead className="hidden sm:table-cell whitespace-nowrap">Date creation</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Expeditions</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Montant</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
                  <TableHead className="text-right pr-4 lg:pr-6 whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const shipmentCount = inv.invoice_lines.reduce((sum, l) => sum + l.shipment_count, 0)
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium pl-4 lg:pl-6 whitespace-nowrap">{formatMonth(inv.month)}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">{formatDate(inv.created_at)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {shipmentCount}
                        {inv.missing_pricing_count > 0 && (
                          <span className="text-amber-600 text-xs ml-1 hidden lg:inline">(+{inv.missing_pricing_count})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{Number(inv.total_eur).toFixed(2)} EUR</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'sent' ? 'info' : 'secondary'} className="text-xs">
                          {inv.status === 'sent' ? 'Envoyée' : inv.status === 'paid' ? 'Payée' : 'Brouillon'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4 lg:pr-6">
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
