import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFastUser, getFastTenantId } from '@/lib/supabase/fast-auth'
import { getAdminDb } from '@/lib/supabase/untyped'

export async function GET(request: NextRequest) {
  try {
    const user = await getFastUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const tenantId = await getFastTenantId() || user.tenant_id
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

    // Get aggregate stats using server-side RPC (avoids PostgREST 1000-row limit)
    const db = getAdminDb()
    const { data: rpcStats, error: rpcError } = await db.rpc('get_shipment_stats', {
      p_tenant_id: tenantId,
      p_from: from || null,
      p_to: to || null,
      p_carrier: carrier || null,
      p_pricing_status: pricingStatus || null,
      p_shipment_status: shipmentStatus || null,
      p_delivery_status: deliveryStatus || null,
      p_search: search || null,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stats: { totalCost: number; totalValue: number; missingPricing: number }

    if (!rpcError && rpcStats) {
      // RPC available - use server-side aggregated stats (accurate for any dataset size)
      stats = {
        totalCost: Number(rpcStats.totalCost) || 0,
        totalValue: Number(rpcStats.totalValue) || 0,
        missingPricing: Number(rpcStats.missingPricing) || 0,
      }
    } else {
      // Fallback: head-only count for missingPricing (always accurate)
      // + row-based sums (capped at 1000 rows by PostgREST default)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const applyFilters = (q: any) => {
        if (from) q = q.gte('shipped_at', from)
        if (to) q = q.lte('shipped_at', to)
        if (carrier) q = q.ilike('carrier', carrier)
        if (shipmentStatus === 'pending') q = q.is('status_id', null)
        else if (shipmentStatus === 'shipped') q = q.not('status_id', 'is', null)
        if (deliveryStatus === 'issue') {
          if (shipmentStatus === 'pending') q = q.eq('has_error', true)
          else q = q.in('status_id', PROBLEM_STATUS_IDS)
        } else if (deliveryStatus === 'delivered') {
          q = q.in('status_id', [11])
        } else if (deliveryStatus === 'in_transit') {
          q = q.in('status_id', [1, 3, 7, 12, 22, 91, 92, 62989, 62990])
        }
        if (search) {
          q = q.or(`order_ref.ilike.%${search}%,tracking.ilike.%${search}%,sendcloud_id.ilike.%${search}%`)
        }
        return q
      }

      // Missing pricing: accurate count via head-only query
      const needsMissingCount = !pricingStatus || pricingStatus === 'missing'
      const missingPromise = needsMissingCount
        ? applyFilters(
            supabase.from('shipments')
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenantId)
              .eq('pricing_status', 'missing')
          )
        : Promise.resolve({ count: 0 })

      // Sums: still limited to 1000 rows without the RPC
      let sumsQuery = supabase
        .from('shipments')
        .select('computed_cost_eur, total_value')
        .eq('tenant_id', tenantId)
      sumsQuery = applyFilters(sumsQuery)
      if (pricingStatus) sumsQuery = sumsQuery.eq('pricing_status', pricingStatus)

      const [missingRes, sumsRes] = await Promise.all([missingPromise, sumsQuery])

      const sumsData = sumsRes.data as Array<{ computed_cost_eur: number | null; total_value: number | null }> | null
      stats = {
        totalCost: sumsData?.reduce((sum: number, s: { computed_cost_eur: number | null }) => sum + (Number(s.computed_cost_eur) || 0), 0) || 0,
        totalValue: sumsData?.reduce((sum: number, s: { total_value: number | null }) => sum + (Number(s.total_value) || 0), 0) || 0,
        missingPricing: missingRes.count || 0,
      }
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
        'Cache-Control': 'private, no-store'
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
