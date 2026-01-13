import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFastUser } from '@/lib/supabase/fast-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getFastUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const tenantId = user.tenant_id
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status')
    const reason = searchParams.get('reason')
    const search = searchParams.get('search')

    // Get pagination params
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('returns')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (from) {
      query = query.gte('created_at', from)
    }

    if (to) {
      query = query.lte('created_at', to)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (reason) {
      query = query.eq('return_reason', reason)
    }

    if (search) {
      query = query.or(`order_ref.ilike.%${search}%,tracking_number.ilike.%${search}%,sender_name.ilike.%${search}%`)
    }

    const { data: returns, error, count } = await query

    if (error) {
      throw error
    }

    // Get aggregate stats
    let statsQuery = supabase
      .from('returns')
      .select('status, return_reason')
      .eq('tenant_id', tenantId)

    if (from) {
      statsQuery = statsQuery.gte('created_at', from)
    }
    if (to) {
      statsQuery = statsQuery.lte('created_at', to)
    }

    const { data: allReturns } = await statsQuery

    const returnsForStats = allReturns as Array<{ status: string; return_reason: string | null }> | null
    const stats = {
      total: returnsForStats?.length || 0,
      announced: returnsForStats?.filter(r => r.status === 'announced').length || 0,
      in_transit: returnsForStats?.filter(r => r.status === 'in_transit').length || 0,
      delivered: returnsForStats?.filter(r => r.status === 'delivered').length || 0,
      byReason: {
        refund: returnsForStats?.filter(r => r.return_reason === 'refund').length || 0,
        exchange: returnsForStats?.filter(r => r.return_reason === 'exchange').length || 0,
        defective: returnsForStats?.filter(r => r.return_reason === 'defective').length || 0,
        wrong_item: returnsForStats?.filter(r => r.return_reason === 'wrong_item').length || 0,
        other: returnsForStats?.filter(r => r.return_reason === 'other' || !r.return_reason).length || 0,
      }
    }

    return NextResponse.json({
      returns,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      },
      stats
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Get returns error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
