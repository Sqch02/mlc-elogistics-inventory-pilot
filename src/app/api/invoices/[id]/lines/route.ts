import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

/**
 * POST /api/invoices/[id]/lines
 * Add a manual line (avoir/credit) to a draft invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id: invoiceId } = await params
    const body = await request.json()

    const { line_type, description, amount } = body

    if (!line_type || !description || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'line_type, description et amount sont requis' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { error: 'Le montant doit être un nombre positif' },
        { status: 400 }
      )
    }

    // Verify invoice exists, belongs to tenant, and is draft
    const { data: invoiceData, error: fetchError } = await supabase
      .from('invoices_monthly')
      .select('id, status')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single()

    const invoice = invoiceData as { id: string; status: string } | null

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seules les factures brouillon peuvent être modifiées' },
        { status: 400 }
      )
    }

    // Get VAT rate from billing config or default
    const { data: billingConfigData } = await supabase
      .from('tenant_billing_config')
      .select('vat_rate_pct')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const billingConfig = billingConfigData as { vat_rate_pct: number } | null
    const vatRate = (billingConfig?.vat_rate_pct ?? 20) / 100

    // Create the avoir line (negative amounts)
    const totalEur = -amount
    const vatAmount = totalEur * vatRate

    const { data: newLine, error: insertError } = await supabase
      .from('invoice_lines')
      .insert({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type,
        description,
        carrier: `_${line_type}`,
        weight_min_grams: 0,
        weight_max_grams: 0,
        shipment_count: 0,
        quantity: 1,
        unit_price_eur: 0,
        total_eur: totalEur,
        vat_amount: vatAmount,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert avoir line:', insertError)
      throw new Error('Erreur lors de l\'ajout de la ligne')
    }

    // Recalculate invoice totals
    await recalculateInvoiceTotals(supabase, invoiceId)

    return NextResponse.json({
      success: true,
      line_id: newLine.id,
      message: 'Avoir ajouté',
    })
  } catch (error) {
    console.error('Add invoice line error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/invoices/[id]/lines
 * Remove a manual line from a draft invoice
 * Query param: ?lineId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id: invoiceId } = await params

    const lineId = request.nextUrl.searchParams.get('lineId')
    if (!lineId) {
      return NextResponse.json({ error: 'lineId requis' }, { status: 400 })
    }

    // Verify invoice exists, belongs to tenant, and is draft
    const { data: invoiceData, error: fetchError } = await supabase
      .from('invoices_monthly')
      .select('id, status')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single()

    const invoice = invoiceData as { id: string; status: string } | null

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seules les factures brouillon peuvent être modifiées' },
        { status: 400 }
      )
    }

    // Verify line belongs to this invoice and is a manual line (avoir)
    const { data: lineData, error: lineError } = await supabase
      .from('invoice_lines')
      .select('id, line_type')
      .eq('id', lineId)
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .single()

    const line = lineData as { id: string; line_type: string } | null

    if (lineError || !line) {
      return NextResponse.json({ error: 'Ligne non trouvée' }, { status: 404 })
    }

    // Only allow deleting manual avoir lines
    if (!line.line_type?.startsWith('avoir')) {
      return NextResponse.json(
        { error: 'Seules les lignes d\'avoir peuvent être supprimées manuellement' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('invoice_lines')
      .delete()
      .eq('id', lineId)

    if (deleteError) {
      throw deleteError
    }

    // Recalculate invoice totals
    await recalculateInvoiceTotals(supabase, invoiceId)

    return NextResponse.json({ success: true, message: 'Avoir supprimé' })
  } catch (error) {
    console.error('Delete invoice line error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * Recalculate invoice totals from all lines
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalculateInvoiceTotals(supabase: any, invoiceId: string) {
  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('total_eur, vat_amount')
    .eq('invoice_id', invoiceId)

  if (!lines) return

  const subtotalHt = lines.reduce(
    (sum: number, l: { total_eur: number }) => sum + Number(l.total_eur),
    0
  )
  const vatAmount = lines.reduce(
    (sum: number, l: { vat_amount: number }) => sum + Number(l.vat_amount || 0),
    0
  )
  const totalTtc = subtotalHt + vatAmount

  await supabase
    .from('invoices_monthly')
    .update({
      subtotal_ht: Math.round(subtotalHt * 100) / 100,
      vat_amount: Math.round(vatAmount * 100) / 100,
      total_ttc: Math.round(totalTtc * 100) / 100,
    })
    .eq('id', invoiceId)
}
