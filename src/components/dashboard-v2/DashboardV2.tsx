'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Package, Banknote, Award, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboard } from '@/hooks/useDashboard'
import { useAnalytics } from '@/hooks/useAnalytics'
import { DashboardHeader } from './DashboardHeader'
import { SecondaryKpiCard } from './SecondaryKpiCard'
import { AreaShipmentsChart } from './AreaShipmentsChart'
import { BillingArcCard } from './BillingArcCard'
import { AlertsTimeline } from './AlertsTimeline'
import { StockHealthPanel } from './StockHealthPanel'
import { ProductsAnalytics } from './ProductsAnalytics'
import { Skeleton } from '@/components/ui/skeleton'
import { CostTrendChart } from '@/components/dashboard/CostTrendChart'
import { CarrierPerformance } from '@/components/dashboard/CarrierPerformance'
import { TodaySummary } from './TodaySummary'
import { useTenant } from '@/components/providers/TenantProvider'
import { HubDashboard } from './HubDashboard'

// Loading skeleton for the dashboard
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>

      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-[120px] rounded-xl" />
        <Skeleton className="h-[120px] rounded-xl" />
        <Skeleton className="h-[120px] rounded-xl" />
        <Skeleton className="h-[120px] rounded-xl" />
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px] rounded-2xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>

      {/* Operations skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[350px] rounded-2xl" />
        <Skeleton className="h-[350px] rounded-2xl" />
        <Skeleton className="h-[350px] rounded-2xl" />
      </div>
    </div>
  )
}

export function DashboardV2() {
  // Get current month in YYYY-MM format
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const { data, isLoading, isRefetching } = useDashboard(selectedMonth)
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalytics()
  const { isClient, isHubView } = useTenant()

  // Hub view: show aggregated multi-client dashboard
  if (isHubView) {
    return <HubDashboard />
  }

  // Generate invoice handler
  const handleGenerateInvoice = async () => {
    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth })
      })
      const result = await response.json()

      if (result.success) {
        toast.success('Facture generee avec succes')
      } else {
        toast.error(result.message || 'Erreur lors de la generation')
      }
    } catch {
      toast.error('Erreur lors de la generation de la facture')
    }
  }

  // Download invoice handler
  const handleDownloadInvoice = () => {
    toast.info('Telechargement de la facture...')
    // TODO: Implement PDF download
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Erreur lors du chargement des donnees
      </div>
    )
  }

  // Extract values
  const shipmentsCount = Number(data.kpis.shipments.value) || 0
  const costValue = data.kpis.cost.value
  const indemnityValue = data.kpis.indemnity.value
  const criticalStockCount = Number(data.kpis.criticalStock.value) || 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <DashboardHeader
        currentMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        lastSync={data.lastSync}
        isRefreshing={isRefetching}
      />

      {/* Section 1: KPIs */}
      <div className={`grid grid-cols-2 ${isClient ? '' : 'lg:grid-cols-4'} gap-4`}>
        <SecondaryKpiCard
          label="Expeditions"
          value={shipmentsCount}
          subValue="ce mois-ci"
          icon={Package}
          status="default"
          delay={0.1}
        />
        {!isClient && (
          <SecondaryKpiCard
            label="Cout Transport"
            value={costValue}
            subValue="ce mois-ci"
            icon={Banknote}
            status="default"
            delay={0.15}
          />
        )}
        {!isClient && (
          <SecondaryKpiCard
            label="Indemnites"
            value={indemnityValue}
            subValue="ce mois-ci"
            icon={Award}
            status={Number(String(indemnityValue).replace(/[^\d.]/g, '')) > 0 ? 'warning' : 'success'}
            delay={0.2}
          />
        )}
        <SecondaryKpiCard
          label="Stock Critique"
          value={criticalStockCount}
          subValue="SKUs < 20 unites"
          icon={AlertTriangle}
          status={criticalStockCount > 0 ? 'danger' : 'success'}
          delay={0.25}
        />
      </div>

      {/* Section 2: Today Summary + Shipments Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TodaySummary />
        <div className="lg:col-span-2">
          <AreaShipmentsChart data={data.chartData} delay={0.3} />
        </div>
      </div>

      {/* Section 3: Cost Trend Chart (hidden for client) */}
      {!isClient && (
        analyticsLoading ? (
          <Skeleton className="h-[350px] rounded-2xl" />
        ) : analyticsData ? (
          <CostTrendChart
            data={analyticsData.costTrend.data}
            percentChange={analyticsData.costTrend.percentChange}
            shipmentsPercentChange={analyticsData.costTrend.shipmentsPercentChange}
          />
        ) : null
      )}

      {/* Section 3: Operations */}
      <div className={`grid grid-cols-1 ${isClient ? '' : 'lg:grid-cols-3'} gap-6`}>
        <StockHealthPanel
          items={data.stockHealth}
          criticalCount={criticalStockCount}
          delay={0.4}
        />
        {!isClient && (
          analyticsLoading ? (
            <Skeleton className="h-[350px] rounded-2xl" />
          ) : analyticsData ? (
            <CarrierPerformance
              data={analyticsData.carrierPerformance.data}
              totalCarriers={analyticsData.carrierPerformance.totalCarriers}
            />
          ) : (
            <div className="bg-card rounded-2xl border border-border/60 p-6 flex items-center justify-center text-muted-foreground">
              Donnees non disponibles
            </div>
          )
        )}
        {!isClient && (
          <BillingArcCard
            billing={data.billing}
            currentMonth={selectedMonth}
            onGenerateInvoice={handleGenerateInvoice}
            onDownloadInvoice={handleDownloadInvoice}
            delay={0.5}
          />
        )}
      </div>

      {/* Section 4: Products Analytics (full width) */}
      <ProductsAnalytics delay={0.6} />

      {/* Section 5: Alerts */}
      <AlertsTimeline alerts={data.alerts} delay={0.7} />
    </motion.div>
  )
}
