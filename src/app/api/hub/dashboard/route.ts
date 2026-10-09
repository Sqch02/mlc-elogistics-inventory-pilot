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
    const jour = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const debutMois = jour(new Date(now.getFullYear(), now.getMonth(), 1))
    const finMois = jour(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    const hier = jour(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

    // Fetch per-tenant metrics in parallel
    const tenantMetrics = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tenants.map(async (tenant: any) => {
        const [metricsRes, stockRes, syncRes, userCountRes] = await Promise.all([
          // Expeditions du mois, cout et tarifs manquants : les memes chiffres
          // que le tableau de bord du client, lus dans mv_dashboard_daily.
          // L'ancienne somme des couts colis par colis s'arretait aux 1 000
          // premieres lignes renvoyees par l'API : 5 454,99 EUR affiches pour
          // 19 242,02 EUR reels chez Florna le 09/10.
          db.rpc('get_dashboard_metrics', {
            p_tenant_id: tenant.id,
            p_month_start: debutMois,
            p_month_end: finMois,
            p_yesterday: hier,
          }),

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

        if (metricsRes.error) {
          console.error(`[Hub] get_dashboard_metrics en echec pour ${tenant.code} :`, metricsRes.error.message ?? metricsRes.error)
        }
        const lignes = (metricsRes.data ?? []) as {
          metric: string
          shipments_count: number | string
          shipments_cost: number | string
          shipments_missing_pricing: number | string
        }[]
        const mois = lignes.find((l) => l.metric === 'month')
        const manquants = lignes.find((l) => l.metric === 'all_time_missing')

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
          shipments: Number(mois?.shipments_count) || 0,
          cost: Number(mois?.shipments_cost) || 0,
          missingPricing: Number(manquants?.shipments_missing_pricing) || 0,
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
      headers: { 'Cache-Control': 'private, no-store' }
    })
  } catch (error) {
    console.error('Hub dashboard error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
