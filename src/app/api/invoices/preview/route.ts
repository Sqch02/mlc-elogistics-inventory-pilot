import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

interface PreviewShipment {
  id: string
  shipped_at: string
  order_ref: string | null
  carrier: string
  weight_grams: number
  computed_cost_eur: number | null
  pricing_status: string
  tracking: string | null
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const { date_from, date_to } = await request.json()

    if (!date_from || !date_to) {
      return NextResponse.json(
        { error: 'date_from et date_to requis' },
        { status: 400 }
      )
    }

    // Validate date format
    const fromDate = new Date(date_from)
    const toDate = new Date(date_to)
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide' },
        { status: 400 }
      )
    }

    // Set end of day for date_to
    const startDate = new Date(date_from + 'T00:00:00.000Z')
    const endDate = new Date(date_to + 'T23:59:59.999Z')

    // Count total eligible shipments
    const { count: totalShipments } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())

    // Count missing pricing
    const { count: missingPricing } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .eq('pricing_status', 'missing')
      .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())

    // Get total cost
    const { data: costData } = await supabase
      .from('shipments')
      .select('computed_cost_eur')
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
      .not('pricing_status', 'eq', 'missing')
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())
      .limit(20000)

    const estimatedTotal = (costData || []).reduce(
      (sum: number, s: { computed_cost_eur: number | null }) => sum + (Number(s.computed_cost_eur) || 0),
      0
    )

    // Count return shipments (from shipments table, is_return = true)
    const { count: returnsCount } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_return', true)
      .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())

    // Get return shipments cost (priced like outbound)
    const { data: returnCostData } = await supabase
      .from('shipments')
      .select('computed_cost_eur')
      .eq('tenant_id', tenantId)
      .eq('is_return', true)
      .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
      .not('pricing_status', 'eq', 'missing')
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())
      .limit(20000)

    const returnsTotal = (returnCostData || []).reduce(
      (sum: number, s: { computed_cost_eur: number | null }) => sum + (Number(s.computed_cost_eur) || 0),
      0
    )

    // Get first 100 shipments for preview table
    const { data: shipments } = await supabase
      .from('shipments')
      .select('id, shipped_at, order_ref, carrier, weight_grams, computed_cost_eur, pricing_status, tracking')
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())
      .order('shipped_at', { ascending: true })
      .limit(100)

    // Get last 10 shipments (for checking the end boundary)
    const { data: lastShipments } = await supabase
      .from('shipments')
      .select('id, shipped_at, order_ref, carrier, weight_grams, computed_cost_eur, pricing_status, tracking')
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())
      .order('shipped_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      shipment_count: totalShipments || 0,
      returns_count: returnsCount || 0,
      missing_pricing: missingPricing || 0,
      estimated_total: Math.round((estimatedTotal + returnsTotal) * 100) / 100,
      first_shipments: (shipments || []) as PreviewShipment[],
      last_shipments: ((lastShipments || []) as PreviewShipment[]).reverse(),
      date_from,
      date_to,
    })
  } catch (error) {
    console.error('Invoice preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
