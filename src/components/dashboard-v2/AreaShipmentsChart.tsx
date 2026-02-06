'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { BarChart3, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenant } from '@/components/providers/TenantProvider'
import type { DashboardChartData } from '@/types/dashboard'

interface AreaShipmentsChartProps {
  data: DashboardChartData[]
  delay?: number
}

// Custom tooltip with glassmorphism
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  const date = new Date(label || '')
  const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' })
  const dayNum = date.getDate()
  const month = date.toLocaleDateString('fr-FR', { month: 'long' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-lg px-4 py-3 shadow-lg"
    >
      <p className="text-sm font-medium text-foreground capitalize">
        {dayName} {dayNum} {month}
      </p>
      <div className="mt-2 space-y-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            {item.dataKey === 'shipments' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Expéditions:</span>
                <span className="font-semibold text-foreground">{item.value}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-gold" />
                <span className="text-muted-foreground">Coût:</span>
                <span className="font-semibold text-foreground">{item.value.toFixed(2)} €</span>
              </>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export function AreaShipmentsChart({ data, delay = 0 }: AreaShipmentsChartProps) {
  const [showCost, setShowCost] = useState(false)
  const { isClient } = useTenant()

  // Calculate totals
  const totalShipments = data.reduce((sum, d) => sum + d.shipments, 0)
  const totalCost = data.reduce((sum, d) => sum + (d.cost || 0), 0)

  // Format day for X axis
  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.getDate().toString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Expéditions par jour</h3>
            <p className="text-sm text-muted-foreground">
              {totalShipments} expéditions{!isClient && ` • ${totalCost.toFixed(2)} € total`}
            </p>
          </div>
        </div>

        {/* Toggle cost overlay (hidden for client) */}
        {!isClient && (
          <button
            onClick={() => setShowCost(!showCost)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              showCost
                ? "bg-gold/10 text-gold"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            {showCost ? 'Masquer coûts' : 'Afficher coûts'}
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="shipmentsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E3A5F" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#1E3A5F" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A227" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#C9A227" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#C9A227" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E8E4DC"
                strokeOpacity={0.5}
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 12 }}
                dy={10}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 12 }}
                dx={-10}
                width={40}
              />

              <Tooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="shipments"
                stroke="#1E3A5F"
                strokeWidth={2.5}
                fill="url(#shipmentsGradient)"
                dot={false}
                activeDot={{
                  r: 6,
                  stroke: '#1E3A5F',
                  strokeWidth: 2,
                  fill: '#FFFFFF'
                }}
              />

              {showCost && (
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#C9A227"
                  strokeWidth={2}
                  fill="url(#costGradient)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    stroke: '#C9A227',
                    strokeWidth: 2,
                    fill: '#FFFFFF'
                  }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <p>Aucune donnée pour cette période</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/40">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Expéditions</span>
        </div>
        {showCost && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gold" />
            <span className="text-sm text-muted-foreground">Coût (€)</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
