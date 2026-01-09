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
    const carrier = searchParams.get('carrier')
    const pricingStatus = searchParams.get('pricing_status')

    // Get pagination params
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('shipments')
      .select(`
        *,
        shipment_items(
          qty,
          skus(sku_code, name)
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('shipped_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (from) {
      query = query.gte('shipped_at', from)
    }

    if (to) {
      query = query.lte('shipped_at', to)
    }

    if (carrier) {
      query = query.ilike('carrier', carrier)
    }

    if (pricingStatus) {
      query = query.eq('pricing_status', pricingStatus)
    }

    const { data: shipments, error, count } = await query

    if (error) {
      throw error
    }

    // Get aggregate stats for all filtered shipments (not just current page)
    let statsQuery = supabase
      .from('shipments')
      .select('computed_cost_eur, pricing_status, total_value')
      .eq('tenant_id', tenantId)

    if (from) {
      statsQuery = statsQuery.gte('shipped_at', from)
    }
    if (to) {
      statsQuery = statsQuery.lte('shipped_at', to)
    }
    if (carrier) {
      statsQuery = statsQuery.ilike('carrier', carrier)
    }
    if (pricingStatus) {
      statsQuery = statsQuery.eq('pricing_status', pricingStatus)
    }

    const { data: allShipments } = await statsQuery

    const shipmentsForStats = allShipments as Array<{ computed_cost_eur: number | null; pricing_status: string | null; total_value: number | null }> | null
    const stats = {
      totalCost: shipmentsForStats?.reduce((sum, s) => sum + (Number(s.computed_cost_eur) || 0), 0) || 0,
      totalValue: shipmentsForStats?.reduce((sum, s) => sum + (Number(s.total_value) || 0), 0) || 0,
      missingPricing: shipmentsForStats?.filter(s => s.pricing_status === 'missing').length || 0,
    }

    return NextResponse.json({
      shipments,
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
    console.error('Get shipments error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
