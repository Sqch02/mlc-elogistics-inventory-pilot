'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Package, Boxes, Calendar, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProductsMetrics } from '@/hooks/useProductsMetrics'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProductsMetricsPanelProps {
  delay?: number
}

const COLORS = {
  products: '#1F7A5A',
  bundles: '#008080',
  gradient: ['#1F7A5A', '#22c55e', '#34d399', '#6ee7b7', '#a7f3d0'],
}

// Period presets
const PERIOD_PRESETS = [
  { label: '3 derniers mois', value: '3m' },
  { label: '6 derniers mois', value: '6m' },
  { label: '12 derniers mois', value: '12m' },
  { label: 'Cette annee', value: 'ytd' },
]

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  switch (preset) {
    case '3m': {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { from: from.toISOString().split('T')[0], to }
    }
    case '6m': {
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      return { from: from.toISOString().split('T')[0], to }
    }
    case '12m': {
      const from = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      return { from: from.toISOString().split('T')[0], to }
    }
    case 'ytd': {
      const from = new Date(now.getFullYear(), 0, 1)
      return { from: from.toISOString().split('T')[0], to }
    }
    default:
      return getDateRange('12m')
  }
}

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function ProductsMetricsPanel({ delay = 0 }: ProductsMetricsPanelProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('12m')
  const { from, to } = getDateRange(selectedPeriod)
  const { data, isLoading } = useProductsMetrics({ from, to, limit: 10 })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[400px] rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[350px] rounded-2xl" />
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Erreur lors du chargement des metriques produits
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header with period selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Metriques Produits & Bundles</h3>
            <p className="text-sm text-muted-foreground">
              Analyse des ventes sur la periode
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground font-medium">Produits vendus</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatNumber(data.summary.totalProductsVolume)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Boxes className="h-4 w-4 text-teal-600" />
            <span className="text-xs text-muted-foreground font-medium">Bundles vendus</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatNumber(data.summary.totalBundlesVolume)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground font-medium">Total expedie</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatNumber(data.summary.totalVolume)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Boxes className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground font-medium">Part Bundles</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{data.summary.bundlePercentage}%</p>
        </div>
      </div>

      {/* Monthly evolution chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.2, duration: 0.5 }}
        className="bg-card rounded-2xl border border-border/60 p-6"
      >
        <h4 className="text-sm font-semibold text-foreground mb-4">Evolution mensuelle</h4>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyVolumes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [
                  formatNumber(value as number),
                  ''
                ]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (value === 'products' ? 'Produits' : 'Bundles')}
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              />
              <Bar dataKey="products" stackId="a" fill={COLORS.products} radius={[0, 0, 0, 0]} />
              <Bar dataKey="bundles" stackId="a" fill={COLORS.bundles} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Top products and bundles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.3, duration: 0.5 }}
          className="bg-card rounded-2xl border border-border/60 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Top 10 Produits</h4>
          </div>
          {data.topProducts.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topProducts.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="sku_code"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [formatNumber(value as number), 'Quantite']}
                    labelFormatter={(label) => {
                      const item = data.topProducts.find(p => p.sku_code === label)
                      return item ? item.name : String(label)
                    }}
                  />
                  <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                    {data.topProducts.slice(0, 10).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS.gradient[Math.min(index, COLORS.gradient.length - 1)]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              Aucune donnee pour cette periode
            </div>
          )}
        </motion.div>

        {/* Top Bundles */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.4, duration: 0.5 }}
          className="bg-card rounded-2xl border border-border/60 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="h-4 w-4 text-teal-600" />
            <h4 className="text-sm font-semibold text-foreground">Top 10 Bundles</h4>
          </div>
          {data.topBundles.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topBundles.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="sku_code"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [formatNumber(value as number), 'Quantite']}
                    labelFormatter={(label) => {
                      const item = data.topBundles.find(b => b.sku_code === label)
                      return item ? item.name : String(label)
                    }}
                  />
                  <Bar dataKey="volume" radius={[0, 4, 4, 0]} fill={COLORS.bundles} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              Aucun bundle vendu sur cette periode
            </div>
          )}
        </motion.div>
      </div>

      {/* Detailed table */}
      {data.topProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.5, duration: 0.5 }}
          className="bg-card rounded-2xl border border-border/60 overflow-hidden"
        >
          <div className="p-4 border-b border-border/60">
            <h4 className="text-sm font-semibold text-foreground">Detail des ventes</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nom</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Volume</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">% du total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.topProducts.slice(0, 10).map((product) => (
                  <tr key={product.sku_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{product.rank}</td>
                    <td className="px-4 py-3 font-mono text-xs">{product.sku_code}</td>
                    <td className="px-4 py-3 truncate max-w-[200px]">{product.name}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatNumber(product.volume)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <div
                          className="h-1.5 bg-primary rounded-full"
                          style={{ width: `${Math.min(product.percentage, 100)}px` }}
                        />
                        <span className="text-muted-foreground">{product.percentage}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
