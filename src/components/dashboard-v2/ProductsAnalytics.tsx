'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Boxes, TrendingUp, ArrowRight, Calendar, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useProductsMetrics, type ProductMetric } from '@/hooks/useProductsMetrics'
import { Skeleton } from '@/components/ui/skeleton'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

interface ProductsAnalyticsProps {
  delay?: number
}

type PeriodKey = '1m' | '3m' | '6m' | '12m'
type TabKey = 'products' | 'bundles'

const PERIODS: { key: PeriodKey; label: string; months: number }[] = [
  { key: '1m', label: '1 mois', months: 1 },
  { key: '3m', label: '3 mois', months: 3 },
  { key: '6m', label: '6 mois', months: 6 },
  { key: '12m', label: '12 mois', months: 12 },
]

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toLocaleString('fr-FR')
}

function getDateRange(months: number) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

function ProductRow({
  item,
  index,
  delay,
  maxVolume,
  color
}: {
  item: ProductMetric
  index: number
  delay: number
  maxVolume: number
  color: string
}) {
  const barWidth = maxVolume > 0 ? (item.volume / maxVolume) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay + index * 0.03 }}
      className="group py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Rank badge */}
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
          index === 0 ? "bg-amber-100 text-amber-700" :
          index === 1 ? "bg-gray-100 text-gray-600" :
          index === 2 ? "bg-orange-100 text-orange-700" :
          "bg-muted text-muted-foreground"
        )}>
          {index + 1}
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono text-xs font-semibold text-foreground truncate" title={item.sku_code}>
              {item.sku_code}
            </span>
            <span className="text-sm font-bold text-foreground whitespace-nowrap">
              {formatNumber(item.volume)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barWidth}%` }}
              transition={{ delay: delay + index * 0.03 + 0.1, duration: 0.5, ease: 'easeOut' }}
              className={cn("h-full rounded-full", color)}
            />
          </div>

          {/* Name (shown on hover or always if space) */}
          <p className="text-[10px] text-muted-foreground mt-1 truncate" title={item.name}>
            {item.name}
          </p>
        </div>

        {/* Percentage */}
        <div className="text-right flex-shrink-0">
          <span className="text-xs font-medium text-muted-foreground">
            {item.percentage.toFixed(1)}%
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export function ProductsAnalytics({ delay = 0 }: ProductsAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('3m')
  const [activeTab, setActiveTab] = useState<TabKey>('products')

  const periodConfig = PERIODS.find(p => p.key === selectedPeriod)!
  const dateRange = useMemo(() => getDateRange(periodConfig.months), [periodConfig.months])

  const { data, isLoading } = useProductsMetrics({
    from: dateRange.from,
    to: dateRange.to,
    limit: 10
  })

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm h-full">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-8 w-full mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { summary, topProducts, topBundles, monthlyVolumes } = data
  const activeItems = activeTab === 'products' ? topProducts : topBundles
  const maxVolume = activeItems.length > 0 ? activeItems[0].volume : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-card rounded-2xl border border-border/60 shadow-sm h-full flex flex-col"
    >
      {/* Header with period selector */}
      <div className="p-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Analyse des Ventes</h3>
              <p className="text-[10px] text-muted-foreground">
                Produits et bundles expedies
              </p>
            </div>
          </div>

          {/* Period selector pills */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
            {PERIODS.map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                  selectedPeriod === period.key
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/10">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold text-foreground">{formatNumber(summary.totalProductsVolume)}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Produits</p>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-teal-500/5 to-teal-500/10 rounded-xl border border-teal-500/10">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Boxes className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-xl font-bold text-foreground">{formatNumber(summary.totalBundlesVolume)}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Bundles</p>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-amber-500/5 to-amber-500/10 rounded-xl border border-amber-500/10">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xl font-bold text-foreground">{summary.bundlePercentage.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground font-medium">% Bundles</p>
          </div>
        </div>
      </div>

      {/* Mini chart */}
      {monthlyVolumes.length > 1 && (
        <div className="px-5 py-3 border-b border-border/40">
          <div className="h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyVolumes} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="productsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1F7A5A" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#1F7A5A" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="bundlesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '11px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value, name) => [
                    formatNumber(Number(value) || 0),
                    name === 'products' ? 'Produits' : 'Bundles'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="products"
                  stroke="#1F7A5A"
                  strokeWidth={2}
                  fill="url(#productsGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="bundles"
                  stroke="#0D9488"
                  strokeWidth={2}
                  fill="url(#bundlesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-5 pt-3">
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
          <button
            onClick={() => setActiveTab('products')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all",
              activeTab === 'products'
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-3.5 w-3.5" />
            Top Produits
            <span className="text-[10px] opacity-70">({topProducts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('bundles')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all",
              activeTab === 'bundles'
                ? "bg-white text-teal-600 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Boxes className="h-3.5 w-3.5" />
            Top Bundles
            <span className="text-[10px] opacity-70">({topBundles.length})</span>
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 px-5 py-3 overflow-y-auto min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeItems.length > 0 ? (
              <div className="space-y-0">
                {activeItems.slice(0, 10).map((item, index) => (
                  <ProductRow
                    key={item.sku_id}
                    item={item}
                    index={index}
                    delay={delay + 0.1}
                    maxVolume={maxVolume}
                    color={activeTab === 'products' ? "bg-gradient-to-r from-primary to-primary/70" : "bg-gradient-to-r from-teal-500 to-teal-400"}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  {activeTab === 'products' ? (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <Boxes className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Aucun {activeTab === 'products' ? 'produit' : 'bundle'} sur cette periode
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer link */}
      <div className="p-4 pt-3 border-t border-border/40">
        <Link
          href="/produits"
          className={cn(
            "flex items-center justify-center gap-1.5 w-full py-2",
            "text-xs font-medium text-primary",
            "hover:bg-primary/5 rounded-lg transition-colors"
          )}
        >
          Voir tous les produits
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}
