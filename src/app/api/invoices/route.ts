import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('invoices_monthly')
      .select(`
        *,
        invoice_lines(*)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })

    if (month) {
      query = query.eq('month', month)
    }

    query = query.range(from, to)

    const { data: invoices, error, count } = await query

    if (error) {
      throw error
    }

    const total = count ?? 0

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
