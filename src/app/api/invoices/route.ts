import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month')
    const pageParam = searchParams.get('page')

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

    // Only apply pagination when explicitly requested
    if (pageParam) {
      const page = Math.max(1, parseInt(pageParam, 10))
      const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)))
      const from = (page - 1) * limit
      const to = from + limit - 1
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
    }

    const { data: invoices, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ invoices })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Get invoices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
