import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { getFastUser } from '@/lib/supabase/fast-auth'

export async function GET() {
  try {
    const user = await getFastUser()
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const db = getAdminDb()

    // Get all active tenants except the super_admin's own (hub) tenant
    const { data: tenants, error: tenantsError } = await db
      .from('tenants')
      .select('id, name, code, is_active')
      .eq('is_active', true)
      .neq('id', user.tenant_id)
      .order('name')

    if (tenantsError) throw tenantsError

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        tenants: [],
        totals: { shipments: 0, cost: 0, missingPricing: 0, criticalStock: 0 },
        month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    // Fetch per-tenant metrics in parallel
    const tenantMetrics = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tenants.map(async (tenant: any) => {
        const [shipmentsRes, costRes, missingRes, stockRes, syncRes, userCountRes] = await Promise.all([
          // Shipments count this month
          db.from('shipments')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .gte('shipped_at', startOfMonth)
            .lte('shipped_at', endOfMonth),

          // Total cost this month (only priced shipments)
          db.from('shipments')
            .select('computed_cost_eur')
            .eq('tenant_id', tenant.id)
            .eq('pricing_status', 'ok')
            .gte('shipped_at', startOfMonth)
            .lte('shipped_at', endOfMonth),

          // Missing pricing count (total)
          db.from('shipments')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('pricing_status', 'missing'),

          // Critical stock (qty < 20)
          db.from('stock_snapshots')
            .select('qty_current, sku_id, skus!inner(sku_code)')
            .eq('tenant_id', tenant.id)
            .lt('qty_current', 20),

          // Last sync
          db.from('sync_runs')
            .select('ended_at, status')
            .eq('tenant_id', tenant.id)
            .eq('source', 'sendcloud')
            .order('ended_at', { ascending: false })
            .limit(1),

          // User count
          db.from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id),
        ])

        const costData = costRes.data as { computed_cost_eur: number | null }[] | null
        const totalCost = costData?.reduce((sum, s) => sum + (Number(s.computed_cost_eur) || 0), 0) || 0

        // Filter out bundles from critical stock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const criticalStock = (stockRes.data || []).filter((s: any) => {
          const code = s.skus?.sku_code || ''
          return !code.toUpperCase().includes('BU-')
        }).length

        const lastSync = syncRes.data?.[0] || null

        return {
          id: tenant.id,
          name: tenant.name,
          code: tenant.code,
          shipments: shipmentsRes.count || 0,
          cost: totalCost,
          missingPricing: missingRes.count || 0,
          criticalStock,
          userCount: userCountRes.count || 0,
          lastSync: lastSync ? {
            date: lastSync.ended_at,
            status: lastSync.status as string,
          } : null,
        }
      })
    )

    // Aggregate totals
    const totals = tenantMetrics.reduce(
      (acc, t) => ({
        shipments: acc.shipments + t.shipments,
        cost: acc.cost + t.cost,
        missingPricing: acc.missingPricing + t.missingPricing,
        criticalStock: acc.criticalStock + t.criticalStock,
      }),
      { shipments: 0, cost: 0, missingPricing: 0, criticalStock: 0 }
    )

    return NextResponse.json({
      tenants: tenantMetrics,
      totals,
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' }
    })
  } catch (error) {
    console.error('Hub dashboard error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
