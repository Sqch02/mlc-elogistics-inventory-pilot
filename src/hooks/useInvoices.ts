'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface InvoiceLine {
  id: string
  line_type: string
  description: string | null
  carrier: string | null
  weight_min_grams: number | null
  weight_max_grams: number | null
  shipment_count: number
  quantity: number | null
  total_eur: number
  unit_price_eur: number | null
  vat_amount: number | null
}

export interface Invoice {
  id: string
  month: string
  total_eur: number
  subtotal_ht: number | null
  vat_amount: number | null
  total_ttc: number | null
  missing_pricing_count: number
  storage_m3: number | null
  reception_quarters: number | null
  returns_count: number | null
  free_returns_count: number | null
  status: 'draft' | 'sent' | 'paid'
  created_at: string
  invoice_lines: InvoiceLine[]
}

export interface InvoiceStats {
  currentMonth: string
  currentMonthTotal: number
  currentMonthCount: number
  avgCostPerShipment: number
  missingPricing: number
  totalPaid: number
  totalPending: number
}

async function fetchInvoices(): Promise<{ invoices: Invoice[]; stats: InvoiceStats }> {
  const response = await fetch('/api/invoices')
  if (!response.ok) throw new Error('Failed to fetch invoices')
  const data = await response.json()

  const invoices = data.invoices as Invoice[]

  // Calculate stats
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const totalPaid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.total_eur), 0)

  const totalPending = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + Number(inv.total_eur), 0)

  // Find current month's invoice and calculate stats
  const currentMonthInvoice = invoices.find(inv => inv.month === currentMonth)
  const currentMonthTotal = currentMonthInvoice?.total_eur || 0
  const currentMonthCount = currentMonthInvoice?.invoice_lines?.reduce(
    (sum, line) => sum + (line.shipment_count || 0), 0
  ) || 0
  const missingPricing = currentMonthInvoice?.missing_pricing_count || 0
  const avgCostPerShipment = currentMonthCount > 0 ? Number(currentMonthTotal) / currentMonthCount : 0

  const stats: InvoiceStats = {
    currentMonth,
    currentMonthTotal: Number(currentMonthTotal),
    currentMonthCount,
    avgCostPerShipment,
    missingPricing,
    totalPaid,
    totalPending,
  }

  return { invoices, stats }
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoices,
    staleTime: 2 * 60 * 1000,
  })
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (month: string) => {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      if (!response.ok) throw new Error('Erreur lors de la génération de la facture')
      const data = await response.json()
      if (!data.success) throw new Error(data.message || 'Erreur lors de la génération')
      return data
    },
    onSuccess: (data) => {
      const totalTtc = data.invoice?.total_ttc || data.invoice?.total_eur
      toast.success(`Facture générée`, {
        description: totalTtc ? `Total TTC: ${Number(totalTtc).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la génération')
    },
  })
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient()

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    sent: 'Envoyée',
    paid: 'Payée',
  }

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/invoices/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Erreur lors de la mise à jour du statut')
      return { ...await response.json(), status }
    },
    onSuccess: (data) => {
      toast.success(`Facture marquée comme ${statusLabels[data.status] || data.status}`)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour')
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Facture supprimée')
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression')
    },
  })
}
