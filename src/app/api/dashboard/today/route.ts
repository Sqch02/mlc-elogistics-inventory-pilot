import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET() {
  try {
    const tenantId = await requireTenant()
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = adminClient as any

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    // Today's shipments
    const { count: shipmentsToday } = await db
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .gte('shipped_at', todayStart.toISOString())
      .lte('shipped_at', todayEnd.toISOString())

    // Today's shipment cost
    const { data: todayShipments } = await db
      .from('shipments')
      .select('computed_cost_eur')
      .eq('tenant_id', tenantId)
      .eq('is_return', false)
      .gte('shipped_at', todayStart.toISOString())
      .lte('shipped_at', todayEnd.toISOString())

    const todayCost = (todayShipments || []).reduce(
      (sum: number, s: { computed_cost_eur: number | null }) => sum + (Number(s.computed_cost_eur) || 0),
      0
    )

    // Open claims needing attention
    const { data: openClaims } = await db
      .from('claims')
      .select('id, order_ref, status, priority, resolution_deadline, opened_at')
      .eq('tenant_id', tenantId)
      .in('status', ['ouverte', 'en_analyse'])
      .order('priority', { ascending: true })
      .order('opened_at', { ascending: true })
      .limit(5)

    // Claims opened today
    const { count: claimsToday } = await db
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('opened_at', todayStart.toISOString())
      .lte('opened_at', todayEnd.toISOString())

    // Overdue claims
    const { count: overdueClaims } = await db
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['ouverte', 'en_analyse'])
      .lt('resolution_deadline', now.toISOString())

    // Critical stock items
    const { data: stockAlerts } = await db
      .from('stock_snapshots')
      .select('sku_id, qty_current, skus!inner(sku_code, name, alert_threshold)')
      .eq('tenant_id', tenantId)
      .lt('qty_current', 10)
      .limit(5)

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
