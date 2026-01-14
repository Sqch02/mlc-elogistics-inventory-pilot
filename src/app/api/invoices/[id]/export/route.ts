import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/auth'
import { generateFECEntries, generateFECFile, generateFECFilename } from '@/lib/utils/export-fec'
import { generateSageEntries, generateSageCSV, generateSageFilename, validateSageBalance } from '@/lib/utils/export-sage'

interface InvoiceLine {
  line_type: string
  description: string
  total_ht: number
  tva_amount: number
  total_ttc: number
}

interface InvoiceData {
  id: string
  invoice_number: string
  month: string
  created_at: string
  total_ht: number
  total_tva: number
  total_ttc: number
  tenants: {
    name: string
    code: string
    siren?: string
  }
  invoice_lines: InvoiceLine[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const supabase = await createClient()
    const { id } = await params

    // Get format from query params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'fec'

    if (!['fec', 'sage'].includes(format)) {
      return NextResponse.json(
        { error: 'Format invalide. Utilisez "fec" ou "sage"' },
        { status: 400 }
      )
    }

    // Fetch invoice with lines and tenant info
    const { data: invoice, error } = await supabase
      .from('invoices_monthly')
      .select(`
        id,
        invoice_number,
        month,
        created_at,
        total_ht,
        total_tva,
        total_ttc,
        tenants!inner (
          name,
          code,
          siren
        ),
        invoice_lines (
          line_type,
          description,
          total_ht,
          tva_amount,
          total_ttc
        )
      `)
      .eq('id', id)
      .single()

    if (error || !invoice) {
      return NextResponse.json(
        { error: 'Facture non trouvée' },
        { status: 404 }
      )
    }

    const typedInvoice = invoice as unknown as InvoiceData

    // Transform for export functions
    const invoiceForExport = {
      id: typedInvoice.id,
      invoiceNumber: typedInvoice.invoice_number,
      month: typedInvoice.month,
      createdAt: typedInvoice.created_at,
      clientCode: typedInvoice.tenants.code || 'CLIENT',
      clientName: typedInvoice.tenants.name,
      lines: typedInvoice.invoice_lines.map(line => ({
        lineType: line.line_type,
        description: line.description,
        totalHT: line.total_ht,
        tva: line.tva_amount,
        totalTTC: line.total_ttc,
      })),
      totalHT: typedInvoice.total_ht,
      totalTVA: typedInvoice.total_tva,
      totalTTC: typedInvoice.total_ttc,
    }

    let content: string
    let filename: string
    let contentType: string

    if (format === 'fec') {
      // Generate FEC format
      const entries = generateFECEntries(invoiceForExport)
      content = generateFECFile(entries)

      const siren = typedInvoice.tenants.siren || '000000000'
      const closingDate = new Date(typedInvoice.created_at)
      filename = generateFECFilename(siren, closingDate)
      contentType = 'text/plain; charset=utf-8'
    } else {
      // Generate Sage format
      const entries = generateSageEntries(invoiceForExport)

      // Validate balance before export
      const validation = validateSageBalance(entries)
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Erreur de balance comptable',
            details: {
              totalDebit: validation.totalDebit,
              totalCredit: validation.totalCredit,
              difference: validation.difference,
            }
          },
          { status: 500 }
        )
      }

      content = generateSageCSV(entries)
      filename = generateSageFilename(typedInvoice.month)
      contentType = 'text/csv; charset=utf-8'
    }

    // Return file download
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })

  } catch (error) {
    console.error('[Export] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'export' },
      { status: 500 }
    )
  }
}
