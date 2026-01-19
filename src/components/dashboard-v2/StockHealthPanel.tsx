'use client'

import { motion } from 'framer-motion'
import { Package, Eye, ArrowRight, TrendingDown, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { StockHealthItem } from '@/types/dashboard'

interface StockHealthPanelProps {
  items: StockHealthItem[]
  criticalCount?: number
  delay?: number
}

function ProgressBar({ value, max = 30, status, delay }: {
  value: number
  max?: number
  status: 'critical' | 'warning' | 'ok'
  delay: number
}) {
  const percentage = Math.min((value / max) * 100, 100)

  const colors = {
    critical: {
      bg: 'bg-red-100',
      fill: 'bg-gradient-to-r from-red-500 to-red-400',
    },
    warning: {
      bg: 'bg-amber-100',
      fill: 'bg-gradient-to-r from-amber-500 to-amber-400',
    },
    ok: {
      bg: 'bg-emerald-100',
      fill: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    }
  }

  const config = colors[status]

  return (
    <div className={cn("h-1.5 rounded-full overflow-hidden", config.bg)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ delay, duration: 0.6, ease: 'easeOut' }}
        className={cn("h-full rounded-full", config.fill)}
      />
    </div>
  )
}

function StockItem({ item, index, delay }: {
  item: StockHealthItem
  index: number
  delay: number
}) {
  const status = item.daysRemaining < 7
    ? 'critical'
    : item.daysRemaining < 14
      ? 'warning'
      : 'ok'

  const badgeColors = {
    critical: 'bg-red-50 text-red-600 border-red-200',
    warning: 'bg-amber-50 text-amber-600 border-amber-200',
    ok: 'bg-emerald-50 text-emerald-600 border-emerald-200'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay + index * 0.05, duration: 0.3 }}
      className="py-2.5 border-b border-border/40 last:border-0"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
          )} />
          <span className="font-mono text-xs font-medium text-foreground truncate">
            {item.sku}
          </span>
        </div>
        <span className={cn(
          "px-1.5 py-0.5 rounded text-[10px] font-semibold border flex-shrink-0",
          badgeColors[status]
        )}>
          {item.daysRemaining}j
        </span>
      </div>

      <ProgressBar
        value={item.daysRemaining}
        max={30}
        status={status}
        delay={delay + index * 0.05 + 0.1}
      />

      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
        <span>{item.stock} unites</span>
        <span className="flex items-center gap-0.5">
          <TrendingDown className="h-2.5 w-2.5" />
          {item.avgConsumption90d || item.consumption30d || 0}/j
        </span>
      </div>
    </motion.div>
  )
}

export function StockHealthPanel({ items, criticalCount, delay = 0 }: StockHealthPanelProps) {
  const sortedItems = [...items].sort((a, b) => a.daysRemaining - b.daysRemaining)
  const displayItems = sortedItems.slice(0, 6)
  const hasMore = items.length > 6

  // Calculate stats
  const critical = items.filter(i => i.daysRemaining < 7).length
  const warning = items.filter(i => i.daysRemaining >= 7 && i.daysRemaining < 30).length
  const healthy = items.filter(i => i.daysRemaining >= 30).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Eye className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sante Stock</h3>
            <p className="text-[10px] text-muted-foreground">
              {items.length} SKU a surveiller
            </p>
          </div>
        </div>
        {(criticalCount || critical) > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs font-medium">
            <AlertTriangle className="h-3 w-3" />
            {criticalCount || critical}
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {items.length > 0 ? (
          <div className="space-y-0">
            {displayItems.map((item, index) => (
              <StockItem
                key={item.sku}
                item={item}
                index={index}
                delay={delay + 0.1}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.3 }}
            className="flex flex-col items-center justify-center py-6 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
              <Package className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-xs text-muted-foreground">
              Stocks OK
            </p>
          </motion.div>
        )}
      </div>

      {/* Summary footer */}
      <div className="mt-3 pt-3 border-t border-border/40">
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div>
            <p className="text-lg font-bold text-red-500">{critical}</p>
            <p className="text-[9px] text-muted-foreground">&lt;7j</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-500">{warning}</p>
            <p className="text-[9px] text-muted-foreground">7-30j</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-500">{healthy}</p>
            <p className="text-[9px] text-muted-foreground">&gt;30j</p>
          </div>
        </div>

        {/* View all link */}
        {hasMore && (
          <Link
            href="/produits?status=critical"
            className={cn(
              "flex items-center justify-center gap-1.5 w-full py-1.5",
              "text-xs font-medium text-primary",
              "hover:bg-primary/5 rounded-lg transition-colors"
            )}
          >
            Voir tout
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </motion.div>
  )
}
