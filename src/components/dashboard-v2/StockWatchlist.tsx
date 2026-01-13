'use client'

import { motion } from 'framer-motion'
import { Package, Eye, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { StockHealthItem } from '@/types/dashboard'

interface StockWatchlistProps {
  items: StockHealthItem[]
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
      bg: 'bg-error/20',
      fill: 'bg-gradient-to-r from-error to-error/80',
      glow: 'glow-pulse-error'
    },
    warning: {
      bg: 'bg-warning/20',
      fill: 'bg-gradient-to-r from-warning to-warning/80',
      glow: ''
    },
    ok: {
      bg: 'bg-success/20',
      fill: 'bg-gradient-to-r from-success to-success/80',
      glow: ''
    }
  }

  const config = colors[status]

  return (
    <div className={cn("h-2 rounded-full overflow-hidden", config.bg)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ delay, duration: 0.8, ease: 'easeOut' }}
        className={cn("h-full rounded-full", config.fill, config.glow)}
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
    critical: 'bg-error/10 text-error',
    warning: 'bg-warning/10 text-warning',
    ok: 'bg-success/10 text-success'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay + index * 0.08, duration: 0.4 }}
      whileHover={{ x: 4 }}
      className={cn(
        "p-3 rounded-lg border border-transparent",
        "hover:border-border/60 hover:bg-muted/30",
        "transition-all duration-200 cursor-pointer group"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-medium text-foreground">
          {item.sku}
        </span>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-xs font-medium",
          badgeColors[status]
        )}>
          {item.daysRemaining}j
        </span>
      </div>

      <ProgressBar
        value={item.daysRemaining}
        max={30}
        status={status}
        delay={delay + index * 0.08 + 0.2}
      />

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          Stock: {item.stock} • Conso: {item.consumption30d}/30j
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  )
}

export function StockWatchlist({ items, delay = 0 }: StockWatchlistProps) {
  const sortedItems = [...items].sort((a, b) => a.daysRemaining - b.daysRemaining)
  const displayItems = sortedItems.slice(0, 6)
  const hasMore = items.length > 6

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Surveillance Stock</h3>
            <p className="text-sm text-muted-foreground">
              {items.length} SKU{items.length > 1 ? 's' : ''} à surveiller
            </p>
          </div>
        </div>
      </div>

      {/* Items list */}
      {items.length > 0 ? (
        <div className="space-y-1">
          {displayItems.map((item, index) => (
            <StockItem
              key={item.sku}
              item={item}
              index={index}
              delay={delay}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.3 }}
          className="flex flex-col items-center justify-center py-8 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
            <Package className="h-6 w-6 text-success" />
          </div>
          <p className="text-sm text-muted-foreground">
            Tous les stocks sont sains
          </p>
        </motion.div>
      )}

      {/* View all link */}
      {hasMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.6 }}
          className="mt-4 pt-4 border-t border-border/40"
        >
          <Link
            href="/produits?status=critical"
            className={cn(
              "flex items-center justify-center gap-2 w-full py-2",
              "text-sm font-medium text-primary",
              "hover:bg-primary/5 rounded-lg transition-colors"
            )}
          >
            Voir tous les {items.length} SKUs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      )}
    </motion.div>
  )
}
