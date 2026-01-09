'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface InvoiceLine {
  id: string
  carrier: string
  weight_min_grams: number
  weight_max_grams: number
  shipment_count: number
  total_eur: number
  unit_price_eur: number | null
}

export interface Invoice {
  id: string
  month: string
  total_eur: number
  missing_pricing_count: number
  status: 'draft' | 'sent' | 'paid'
  created_at: string
  invoice_lines: InvoiceLine[]
}

export interface InvoiceStats {
  currentMonth: string
  currentMonthTotal: number
  currentMonthCount: number
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

  const stats: InvoiceStats = {
    currentMonth,
    currentMonthTotal: 0,
    currentMonthCount: 0,
    missingPricing: 0,
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
      const total = data.invoice?.total_eur
      toast.success(`Facture générée`, {
        description: total ? `Total: ${Number(total).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` : undefined,
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
