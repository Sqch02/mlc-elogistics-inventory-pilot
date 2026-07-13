import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFastUser, getFastTenantId } from '@/lib/supabase/fast-auth'
import { getAdminDb } from '@/lib/supabase/untyped'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'
import type { Json, PricingStatus } from '@/types/database'

function isPricingStatus(value: string): value is PricingStatus {
  return value === 'ok' || value === 'missing'
}

function isShipmentStats(
  value: Json,
): value is { totalCost?: Json; totalValue?: Json; missingPricing?: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
    const pricingStatusParam = searchParams.get('pricing_status')
    let pricingStatus: PricingStatus | null = null
    if (pricingStatusParam) {
      if (!isPricingStatus(pricingStatusParam)) {
        return NextResponse.json({ error: 'Statut de tarification invalide' }, { status: 400 })
      }
      pricingStatus = pricingStatusParam
    }
    const shipmentStatus = searchParams.get('shipment_status') // 'pending' | 'shipped' | null
    const deliveryStatus = searchParams.get('delivery_status') // 'delivered' | 'in_transit' | 'issue' | null
    const search = searchParams.get('search')

    // Get pagination params
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const offset = (page - 1) * pageSize

    // Explicit column list to avoid pulling the heavy raw_json JSONB field on every row
    const SHIPMENT_COLUMNS = 'id, tenant_id, sendcloud_id, shipped_at, carrier, service, weight_grams, order_ref, tracking, pricing_status, computed_cost_eur, total_value, currency, recipient_name, recipient_email, recipient_phone, recipient_company, address_line1, address_line2, house_number, city, postal_code, country_code, country_name, status_id, status_message, tracking_url, label_url, service_point_id, is_return, collo_count, external_order_id, date_created, date_updated, date_announced, has_error, error_message, length_cm, width_cm, height_cm' as const

    // Query shipments without the nested shipment_items join (split for speed).
    // The nested PostgREST join was turning 100 shipments into a slow N+1-style
    // lookup; splitting into 2 queries in parallel is 2-3x faster.
    let query = supabase
      .from('shipments')
      .select(SHIPMENT_COLUMNS, { count: 'exact' })
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
      const sanitizedSearch = sanitizeSearchInput(search)
      if (sanitizedSearch) {
        query = query.or(`order_ref.ilike.%${sanitizedSearch}%,tracking.ilike.%${sanitizedSearch}%,sendcloud_id.ilike.%${sanitizedSearch}%`)
      }
    }

    const db = getAdminDb()

    // Run main shipments query + aggregate stats RPC in parallel
    const [shipmentsRes, rpcRes] = await Promise.all([
      query,
      db.rpc('get_shipment_stats', {
        p_tenant_id: tenantId,
        p_from: from || undefined,
        p_to: to || undefined,
        p_carrier: carrier || undefined,
        p_pricing_status: pricingStatus || undefined,
        p_shipment_status: shipmentStatus || undefined,
        p_delivery_status: deliveryStatus || undefined,
        p_search: search || undefined,
      }),
    ])

    const { data: shipments, error, count } = shipmentsRes
    if (error) throw error

    // Fetch shipment_items separately for the current page of shipments
    // (avoids the nested PostgREST join which was the slowest part of this query)
    interface ItemRow { shipment_id: string; qty: number; skus: { sku_code: string; name: string } | null }
    const shipmentIds = (shipments || []).map((s) => s.id)
    const itemsByShipment = new Map<string, Array<{ qty: number; skus: { sku_code: string; name: string } | null }>>()
    if (shipmentIds.length > 0) {
      // Chunk the IN() query. The export fetches pages of 1000 shipments; a
      // single .in() with 1000 UUIDs builds a URL too long for PostgREST and
      // the query silently returns nothing, leaving the export SKU/articles
      // columns empty (signale par Quentin 24/06). 200 IDs per chunk stays
      // well within URL limits. Chunks run in parallel.
      const CHUNK = 200
      const chunks: string[][] = []
      for (let i = 0; i < shipmentIds.length; i += CHUNK) {
        chunks.push(shipmentIds.slice(i, i + CHUNK))
      }
      const chunkResults = await Promise.all(
        chunks.map((slice) =>
          db
            .from('shipment_items')
            .select('shipment_id, qty, skus(sku_code, name)')
            .eq('tenant_id', tenantId)
            .in('shipment_id', slice),
        ),
      )
      for (const { data: items, error: itemsErr } of chunkResults) {
        if (itemsErr) {
          console.error('[shipments] items chunk error:', itemsErr.message)
          continue
        }
        for (const it of ((items || []) as unknown as ItemRow[])) {
          const arr = itemsByShipment.get(it.shipment_id) || []
          arr.push({ qty: it.qty, skus: it.skus })
          itemsByShipment.set(it.shipment_id, arr)
        }
      }
    }

    // Merge items into shipments
    const shipmentsWithItems = (shipments || []).map((s) => ({
      ...s,
      shipment_items: itemsByShipment.get(s.id) || [],
    }))

    const rpcStats = rpcRes.data
    const rpcError = rpcRes.error

    let stats: { totalCost: number; totalValue: number; missingPricing: number }

    if (!rpcError && rpcStats && isShipmentStats(rpcStats)) {
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
          const s = sanitizeSearchInput(search)
          if (s) {
            q = q.or(`order_ref.ilike.%${s}%,tracking.ilike.%${s}%,sendcloud_id.ilike.%${s}%`)
          }
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
      shipments: shipmentsWithItems,
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
