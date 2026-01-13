'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Banknote, Award } from 'lucide-react'
import { toast } from 'sonner'
import { useDashboard } from '@/hooks/useDashboard'
import { DashboardHeader } from './DashboardHeader'
import { HeroMetricCard } from './HeroMetricCard'
import { SecondaryKpiCard } from './SecondaryKpiCard'
import { RadialStockHealth } from './RadialStockHealth'
import { AreaShipmentsChart } from './AreaShipmentsChart'
import { BillingArcCard } from './BillingArcCard'
import { AlertsTimeline } from './AlertsTimeline'
import { StockWatchlist } from './StockWatchlist'
import { Skeleton } from '@/components/ui/skeleton'

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

      {/* Main grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-[200px] rounded-2xl" />
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-[140px] rounded-xl" />
            <Skeleton className="h-[140px] rounded-xl" />
          </div>
          <Skeleton className="h-[250px] rounded-2xl" />
          <Skeleton className="h-[200px] rounded-2xl" />
        </div>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px] rounded-2xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
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
        toast.success('Facture générée avec succès')
      } else {
        toast.error(result.message || 'Erreur lors de la génération')
      }
    } catch {
      toast.error('Erreur lors de la génération de la facture')
    }
  }

  // Download invoice handler
  const handleDownloadInvoice = () => {
    toast.info('Téléchargement de la facture...')
    // TODO: Implement PDF download
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Erreur lors du chargement des données
      </div>
    )
  }

  // Prepare sparkline data from chart data (last 7 days)
  const sparklineData = data.chartData.slice(-7).map(d => ({ value: d.shipments }))

  // Calculate trend (compare with previous month if possible)
  const currentTotal = Number(data.kpis.shipments.value) || 0
  const trend = currentTotal > 0
    ? { value: 12, isPositive: true } // Placeholder - would need previous month data
    : undefined

  // Get critical stock count
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

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Hero + Chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Metric Card */}
          <HeroMetricCard
            value={currentTotal}
            label="Expéditions"
            subLabel="ce mois-ci"
            trend={trend}
            sparklineData={sparklineData}
            delay={0.2}
          />

          {/* Area Chart */}
          <AreaShipmentsChart data={data.chartData} delay={0.6} />
        </div>

        {/* Right column - KPIs + Radial + Billing */}
        <div className="space-y-6">
          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 gap-4">
            <SecondaryKpiCard
              label="Coût Transport"
              value={data.kpis.cost.value}
              subValue="ce mois-ci"
              icon={Banknote}
              status="default"
              delay={0.4}
            />
            <SecondaryKpiCard
              label="Indemnités"
              value={data.kpis.indemnity.value}
              subValue="ce mois-ci"
              icon={Award}
              status={Number(String(data.kpis.indemnity.value).replace(/[^\d.]/g, '')) > 0 ? 'warning' : 'success'}
              delay={0.5}
            />
          </div>

          {/* Radial Stock Health */}
          <RadialStockHealth
            stockHealth={data.stockHealth}
            criticalCount={criticalStockCount}
            delay={0.6}
          />

          {/* Billing Arc Card */}
          <BillingArcCard
            billing={data.billing}
            currentMonth={selectedMonth}
            onGenerateInvoice={handleGenerateInvoice}
            onDownloadInvoice={handleDownloadInvoice}
            delay={0.8}
          />
        </div>
      </div>

      {/* Bottom row - Alerts + Stock Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertsTimeline alerts={data.alerts} delay={1.0} />
        <StockWatchlist items={data.stockHealth} delay={1.2} />
      </div>
    </motion.div>
  )
}
