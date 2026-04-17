import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFastUser, getFastTenantId } from '@/lib/supabase/fast-auth'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'

interface ReturnRow {
  id: string
  tenant_id: string
  sendcloud_id: string
  order_ref: string | null
  status: string
  return_reason: string | null
  return_reason_comment: string | null
  sender_name: string | null
  sender_company: string | null
  sender_email: string | null
  sender_phone: string | null
  sender_address: string | null
  sender_postal_code: string | null
  sender_city: string | null
  sender_country_code: string | null
  carrier: string | null
  service: string | null
  tracking_number: string | null
  tracking_url: string | null
  announced_at: string | null
  created_at: string
}

interface ShipmentData {
  carrier: string | null
  service: string | null
  city: string | null
  address_line1: string | null
  postal_code: string | null
  country_code: string | null
  date_announced: string | null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getFastUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const tenantId = await getFastTenantId() || user.tenant_id
    const supabase = await createClient()
    const adminClient = createAdminClient()

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
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = sanitizeSearchInput(search)
      if (sanitizedSearch) {
        query = query.or(`order_ref.ilike.%${sanitizedSearch}%,tracking_number.ilike.%${sanitizedSearch}%,sender_name.ilike.%${sanitizedSearch}%`)
      }
    }

    const { data: returnsData, error, count } = await query

    // Enrich returns with carrier/service data from shipments table
    let returns = returnsData as ReturnRow[] | null
    if (returns && returns.length > 0) {
      const sendcloudIds = returns.map(r => r.sendcloud_id)

      // Get matching shipments with carrier/service info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = adminClient as any
      const { data: shipments } = await db
        .from('shipments')
        .select('sendcloud_id, carrier, service, city, address_line1, postal_code, country_code, date_announced')
        .eq('tenant_id', tenantId)
        .eq('is_return', true)
        .in('sendcloud_id', sendcloudIds) as { data: (ShipmentData & { sendcloud_id: string })[] | null }

      // Create a map for quick lookup
      const shipmentMap = new Map<string, ShipmentData>()
      if (shipments) {
        for (const s of shipments) {
          shipmentMap.set(s.sendcloud_id, s)
        }
      }

      // Merge shipment data into returns
      returns = returns.map(r => {
        const shipmentData = shipmentMap.get(r.sendcloud_id)
        if (shipmentData) {
          return {
            ...r,
            carrier: r.carrier || shipmentData.carrier,
            service: r.service || shipmentData.service,
            sender_city: r.sender_city || shipmentData.city,
            sender_address: r.sender_address || shipmentData.address_line1,
            sender_postal_code: r.sender_postal_code || shipmentData.postal_code,
            sender_country_code: r.sender_country_code || shipmentData.country_code,
            announced_at: r.announced_at || shipmentData.date_announced,
          }
        }
        return r
      })
    }

    if (error) {
      throw error
    }

    // Get aggregate stats via parallel count queries (HEAD requests, no row data fetched)
    const buildStatsQuery = () => {
      let q = supabase
        .from('returns')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
      if (from) q = q.gte('created_at', from)
      if (to) q = q.lte('created_at', to)
      return q
    }

    const [
      totalRes,
      announcedRes,
      inTransitRes,
      deliveredRes,
      refundRes,
      exchangeRes,
      defectiveRes,
      wrongItemRes,
      otherReasonRes,
      nullReasonRes,
    ] = await Promise.all([
      buildStatsQuery(),
      buildStatsQuery().eq('status', 'announced'),
      buildStatsQuery().eq('status', 'in_transit'),
      buildStatsQuery().eq('status', 'delivered'),
      buildStatsQuery().eq('return_reason', 'refund'),
      buildStatsQuery().eq('return_reason', 'exchange'),
      buildStatsQuery().eq('return_reason', 'defective'),
      buildStatsQuery().eq('return_reason', 'wrong_item'),
      buildStatsQuery().eq('return_reason', 'other'),
      buildStatsQuery().is('return_reason', null),
    ])

    const stats = {
      total: totalRes.count || 0,
      announced: announcedRes.count || 0,
      in_transit: inTransitRes.count || 0,
      delivered: deliveredRes.count || 0,
      byReason: {
        refund: refundRes.count || 0,
        exchange: exchangeRes.count || 0,
        defective: defectiveRes.count || 0,
        wrong_item: wrongItemRes.count || 0,
        other: (otherReasonRes.count || 0) + (nullReasonRes.count || 0),
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
        'Cache-Control': 'private, no-store'
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
