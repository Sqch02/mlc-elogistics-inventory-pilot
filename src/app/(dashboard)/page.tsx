'use client'

import { useState } from 'react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { KpiCard } from '@/components/dashboard/DashboardKpiCard'
import { ShipmentsChart } from '@/components/dashboard/ShipmentsChart'
import { StockHealthPanel } from '@/components/dashboard/StockHealthPanel'
import { AlertsPanel } from '@/components/dashboard/AlertsPanel'
import { BillingWidget } from '@/components/dashboard/BillingWidget'
import { TopSkusTable } from '@/components/dashboard/TopSkusTable'
import { useDashboard } from '@/hooks/useDashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Generate last 12 months options
function getMonthOptions() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    months.push({ value, label })
  }
  return months
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 max-w-[1280px] mx-auto">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-8 p-4 h-[300px]">
          <Skeleton className="h-full w-full" />
        </Card>
        <div className="col-span-4 space-y-4">
          <Card className="p-4 h-[140px]">
            <Skeleton className="h-full w-full" />
          </Card>
          <Card className="p-4 h-[140px]">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const monthOptions = getMonthOptions()
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined)

  const { data, isLoading, isFetching } = useDashboard(selectedMonth)

  if (isLoading || !data) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-4 max-w-[1280px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <DashboardHeader
          currentMonth={data.currentMonth || new Date().toISOString()}
          lastSync={data.lastSync}
        />
        <div className="flex items-center gap-2">
          <Select
            value={selectedMonth || monthOptions[0].value}
            onValueChange={(v) => setSelectedMonth(v === monthOptions[0].value ? undefined : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sélectionner mois" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFetching && (
            <span className="text-xs text-muted-foreground animate-pulse">Chargement...</span>
          )}
        </div>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard title={data.kpis.shipments.label} iconName="Truck" data={data.kpis.shipments} />
        <KpiCard title={data.kpis.cost.label} iconName="DollarSign" data={data.kpis.cost} />
        <KpiCard title={data.kpis.indemnity.label} iconName="AlertTriangle" data={data.kpis.indemnity} />
        <KpiCard title={data.kpis.criticalStock.label} iconName="Package" data={data.kpis.criticalStock} />
      </div>

      {/* Row 2: Chart (Left) + Stack (Right) */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <ShipmentsChart data={data.chartData} />
        </div>
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <StockHealthPanel items={data.stockHealth} />
          <TopSkusTable items={data.stockHealth} />
        </div>
      </div>

      {/* Row 3: Alerts & Billing */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <AlertsPanel alerts={data.alerts} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <BillingWidget data={data.billing} month={data.currentMonth} />
        </div>
      </div>
    </div>
  )
}
