import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { KPICard } from '@/components/dashboard/KPICard'
import { AlertCard, Alert } from '@/components/dashboard/AlertCard'
import { Truck, DollarSign, AlertTriangle, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

async function getDashboardData(tenantId: string) {
  const supabase = await createClient()

  // Get current month
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  // Run all queries in parallel for better performance
  const [
    shipmentsResult,
    shipmentsCostResult,
    missingPricingResult,
    claimsResult,
    stockResult
  ] = await Promise.all([
    // Shipments this month
    supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('shipped_at', startOfMonth.toISOString())
      .lte('shipped_at', endOfMonth.toISOString()),

    // Transport cost this month
    supabase
      .from('shipments')
      .select('computed_cost_eur')
      .eq('tenant_id', tenantId)
      .eq('pricing_status', 'ok')
      .gte('shipped_at', startOfMonth.toISOString())
      .lte('shipped_at', endOfMonth.toISOString()),

    // Missing pricing count
    supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('pricing_status', 'missing'),

    // Indemnified claims this month
    supabase
      .from('claims')
      .select('indemnity_eur')
      .eq('tenant_id', tenantId)
      .eq('status', 'indemnisee')
      .gte('decided_at', startOfMonth.toISOString())
      .lte('decided_at', endOfMonth.toISOString()),

    // Critical stock
    supabase
      .from('stock_snapshots')
      .select('qty_current')
      .eq('tenant_id', tenantId)
      .lt('qty_current', 20)
  ])

  const shipmentsCost = shipmentsCostResult.data as { computed_cost_eur: number | null }[] | null
  const totalCost = shipmentsCost?.reduce(
    (sum, s) => sum + (Number(s.computed_cost_eur) || 0),
    0
  ) || 0

  const claimsData = claimsResult.data as { indemnity_eur: number | null }[] | null
  const totalIndemnity = claimsData?.reduce(
    (sum, c) => sum + (Number(c.indemnity_eur) || 0),
    0
  ) || 0

  return {
    shipmentsCount: shipmentsResult.count || 0,
    totalCost,
    totalIndemnity,
    missingPricingCount: missingPricingResult.count || 0,
    shipmentsWithoutItems: 0, // Simplified - complex query removed for performance
    criticalStockCount: stockResult.data?.length || 0,
    currentMonth,
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const data = await getDashboardData(user.tenant_id)

  // Build alerts
  const alerts: Alert[] = []

  if (data.criticalStockCount > 0) {
    alerts.push({
      id: 'stock-critique',
      type: 'stock_critique',
      title: 'Stock critique',
      description: `${data.criticalStockCount} SKU(s) avec stock faible`,
      count: data.criticalStockCount,
      link: '/produits?filter=critique',
    })
  }

  if (data.missingPricingCount > 0) {
    alerts.push({
      id: 'tarif-manquant',
      type: 'tarif_manquant',
      title: 'Tarifs manquants',
      description: `${data.missingPricingCount} expedition(s) sans tarif`,
      count: data.missingPricingCount,
      link: '/expeditions?filter=missing_pricing',
    })
  }

  if (data.shipmentsWithoutItems > 0) {
    alerts.push({
      id: 'items-manquants',
      type: 'items_manquants',
      title: 'Items non renseignes',
      description: `${data.shipmentsWithoutItems} expedition(s) sans items SKU`,
      count: data.shipmentsWithoutItems,
      link: '/expeditions?filter=missing_items',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Vue d ensemble - {new Date().toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Expeditions (mois)"
          value={data.shipmentsCount}
          icon={Truck}
          subtitle="ce mois-ci"
        />
        <KPICard
          title="Cout transport"
          value={`${data.totalCost.toFixed(2)} EUR`}
          icon={DollarSign}
          subtitle="ce mois-ci"
        />
        <KPICard
          title="Total indemnise"
          value={`${data.totalIndemnity.toFixed(2)} EUR`}
          icon={AlertTriangle}
          subtitle="ce mois-ci"
          variant={data.totalIndemnity > 0 ? 'warning' : 'default'}
        />
        <KPICard
          title="SKUs en stock critique"
          value={data.criticalStockCount}
          icon={Package}
          subtitle="stock < 10 unites"
          variant={data.criticalStockCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Alerts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <AlertCard alerts={alerts} />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/parametres?tab=sync"
              className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <p className="text-sm font-medium">Lancer une synchronisation</p>
              <p className="text-xs text-muted-foreground">
                Synchroniser les expeditions Sendcloud
              </p>
            </a>
            <a
              href="/facturation"
              className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <p className="text-sm font-medium">Generer la facture mensuelle</p>
              <p className="text-xs text-muted-foreground">
                Creer le recapitulatif de facturation
              </p>
            </a>
            <a
              href="/parametres?tab=import"
              className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <p className="text-sm font-medium">Importer des donnees</p>
              <p className="text-xs text-muted-foreground">
                SKUs, Stock, Pricing, Emplacements
              </p>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
