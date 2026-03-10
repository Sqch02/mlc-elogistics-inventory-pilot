import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = adminClient as any

    // Get date from query params or use today
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')

    const now = new Date()
    const selectedDate = dateParam ? new Date(dateParam) : now

    const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59)

    // Previous day's date range
    const prevDayStart = new Date(dayStart)
    prevDayStart.setDate(prevDayStart.getDate() - 1)
    const prevDayEnd = new Date(prevDayStart)
    prevDayEnd.setHours(23, 59, 59, 999)

    // Run all independent queries in parallel
    const [
      { count: shipmentsToday },
      { data: todayShipments },
      { data: openClaims },
      { count: claimsToday },
      { count: claimsYesterday },
      { count: overdueClaims },
      { data: stockAlerts },
    ] = await Promise.all([
      // Today's shipments count
      db
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_return', false)
        .gte('shipped_at', dayStart.toISOString())
        .lte('shipped_at', dayEnd.toISOString()),
      // Today's shipment costs
      db
        .from('shipments')
        .select('computed_cost_eur')
        .eq('tenant_id', tenantId)
        .eq('is_return', false)
        .gte('shipped_at', dayStart.toISOString())
        .lte('shipped_at', dayEnd.toISOString()),
      // Open claims needing attention
      db
        .from('claims')
        .select('id, order_ref, status, priority, resolution_deadline, opened_at')
        .eq('tenant_id', tenantId)
        .in('status', ['ouverte', 'en_analyse'])
        .order('priority', { ascending: true })
        .order('opened_at', { ascending: true })
        .limit(5),
      // Claims opened today
      db
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('opened_at', dayStart.toISOString())
        .lte('opened_at', dayEnd.toISOString()),
      // Claims opened yesterday
      db
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('opened_at', prevDayStart.toISOString())
        .lte('opened_at', prevDayEnd.toISOString()),
      // Overdue claims
      db
        .from('claims')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['ouverte', 'en_analyse'])
        .lt('resolution_deadline', now.toISOString()),
      // Critical stock items
      db
        .from('stock_snapshots')
        .select('sku_id, qty_current, skus!inner(sku_code, name, alert_threshold)')
        .eq('tenant_id', tenantId)
        .lt('qty_current', 10)
        .limit(5),
    ])

    const todayCost = (todayShipments || []).reduce(
      (sum: number, s: { computed_cost_eur: number | null }) => sum + (Number(s.computed_cost_eur) || 0),
      0
    )

    const criticalStock = (stockAlerts || [])
      .filter((s: { qty_current: number; skus: { alert_threshold: number | null } }) =>
        s.qty_current <= (s.skus?.alert_threshold || 10)
      )
      .map((s: { sku_id: string; qty_current: number; skus: { sku_code: string; name: string } }) => ({
        sku_id: s.sku_id,
        sku_code: s.skus.sku_code,
        name: s.skus.name,
        qty: s.qty_current,
      }))

    return NextResponse.json({
      shipments: {
        today: shipmentsToday || 0,
        cost: Math.round(todayCost * 100) / 100,
      },
      claims: {
        today: claimsToday || 0,
        yesterday: claimsYesterday || 0,
        open: openClaims || [],
        overdue: overdueClaims || 0,
      },
      stock: {
        critical: criticalStock,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Today summary error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
