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
    const shipmentStatus = searchParams.get('shipment_status') // 'pending' | 'shipped' | null
    const deliveryStatus = searchParams.get('delivery_status') // 'delivered' | 'in_transit' | 'issue' | null
    const search = searchParams.get('search')

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

    // Filter by shipment status (pending = On Hold, shipped = has tracking)
    if (shipmentStatus === 'pending') {
      query = query.is('status_id', null)
    } else if (shipmentStatus === 'shipped') {
      query = query.not('status_id', 'is', null)
    }

    // Filter by delivery status (issues = actual problem statuses)
    // Real problems: announcement failed, unknown, delivery failed, unable to deliver, exception, returned, refused, cancelled
    const PROBLEM_STATUS_IDS = [1002, 1337, 8, 80, 62996, 62992, 62991, 2000]
    if (deliveryStatus === 'issue') {
      if (shipmentStatus === 'pending') {
        // For pending shipments (On Hold), use has_error flag (only true if actual Sendcloud error)
        query = query.eq('has_error', true)
      } else {
        query = query.in('status_id', PROBLEM_STATUS_IDS)
      }
    } else if (deliveryStatus === 'delivered') {
      query = query.in('status_id', [11]) // 11 = Delivered
    } else if (deliveryStatus === 'in_transit') {
      // In transit states: en route, sorting, at customs, driver en route, etc.
      query = query.in('status_id', [1, 3, 7, 12, 22, 91, 92, 62989, 62990])
    }

    // Search by order_ref, tracking, or sendcloud_id
    if (search) {
      query = query.or(`order_ref.ilike.%${search}%,tracking.ilike.%${search}%,sendcloud_id.ilike.%${search}%`)
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
    if (shipmentStatus === 'pending') {
      statsQuery = statsQuery.is('status_id', null)
    } else if (shipmentStatus === 'shipped') {
      statsQuery = statsQuery.not('status_id', 'is', null)
    }
    if (deliveryStatus === 'issue') {
      if (shipmentStatus === 'pending') {
        statsQuery = statsQuery.eq('has_error', true)
      } else {
        statsQuery = statsQuery.in('status_id', PROBLEM_STATUS_IDS)
      }
    } else if (deliveryStatus === 'delivered') {
      statsQuery = statsQuery.in('status_id', [11])
    } else if (deliveryStatus === 'in_transit') {
      statsQuery = statsQuery.in('status_id', [1, 3, 7, 12, 22, 91, 92, 62989, 62990])
    }
    if (search) {
      statsQuery = statsQuery.or(`order_ref.ilike.%${search}%,tracking.ilike.%${search}%,sendcloud_id.ilike.%${search}%`)
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
