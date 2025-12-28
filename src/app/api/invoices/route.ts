import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month')

    let query = supabase
      .from('invoices_monthly')
      .select(`
        *,
        invoice_lines(*)
      `)
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })

    if (month) {
      query = query.eq('month', month)
    }

    const { data: invoices, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
