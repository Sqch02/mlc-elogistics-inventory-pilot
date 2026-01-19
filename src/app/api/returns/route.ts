import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFastUser } from '@/lib/supabase/fast-auth'

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

    const tenantId = user.tenant_id
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
      query = query.or(`order_ref.ilike.%${search}%,tracking_number.ilike.%${search}%,sender_name.ilike.%${search}%`)
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
