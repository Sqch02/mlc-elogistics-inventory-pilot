import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()
    const { id } = await params

    const { data: invoice, error } = await supabase
      .from('invoices_monthly')
      .select(`
        *,
        invoice_lines(*)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      throw error
    }

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Get invoice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()
    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Check if invoice exists and belongs to tenant
    const { data: invoiceData, error: fetchError } = await supabase
      .from('invoices_monthly')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    const invoice = invoiceData as { id: string; status: string } | null

    if (fetchError || !invoice) {
      return NextResponse.json(
        { error: 'Facture non trouvée' },
        { status: 404 }
      )
    }

    // Only allow deletion of draft invoices
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seules les factures en brouillon peuvent être supprimées' },
        { status: 400 }
      )
    }

    // Delete invoice lines first (cascade should handle this but being explicit)
    await db
      .from('invoice_lines')
      .delete()
      .eq('invoice_id', id)

    // Delete the invoice
    const { error: deleteError } = await db
      .from('invoices_monthly')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete invoice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
