'use client'

import { motion } from 'framer-motion'
import { Package, Boxes, TrendingUp, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useProductsMetrics } from '@/hooks/useProductsMetrics'
import { Skeleton } from '@/components/ui/skeleton'

interface ProductsSummaryProps {
  delay?: number
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

export function ProductsSummary({ delay = 0 }: ProductsSummaryProps) {
  // Get last 3 months by default
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0]
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data, isLoading } = useProductsMetrics({ from, to, limit: 5 })

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm h-full">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { summary, topProducts } = data

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ventes 3 mois</h3>
          <p className="text-[10px] text-muted-foreground">
            Produits et bundles expedies
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Package className="h-3 w-3 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">{formatNumber(summary.totalProductsVolume)}</p>
          <p className="text-[9px] text-muted-foreground">Produits</p>
        </div>
        <div className="text-center p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Boxes className="h-3 w-3 text-teal-600" />
          </div>
          <p className="text-lg font-bold text-foreground">{formatNumber(summary.totalBundlesVolume)}</p>
          <p className="text-[9px] text-muted-foreground">Bundles</p>
        </div>
        <div className="text-center p-2 bg-muted/30 rounded-lg">
          <p className="text-lg font-bold text-foreground">{summary.bundlePercentage}%</p>
          <p className="text-[9px] text-muted-foreground">% Bundles</p>
        </div>
      </div>

      {/* Top 5 products */}
      <div className="flex-1 min-h-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Top 5 produits
        </p>
        <div className="space-y-2">
          {topProducts.slice(0, 5).map((product, index) => (
            <motion.div
              key={product.sku_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.1 + index * 0.05 }}
              className="flex items-center gap-2"
            >
              <span className="text-[10px] text-muted-foreground w-4">{index + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${product.percentage}%` }}
                    transition={{ delay: delay + 0.2 + index * 0.05, duration: 0.5 }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono text-foreground truncate max-w-[60px]">
                {product.sku_code}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatNumber(product.volume)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer link */}
      <div className="mt-3 pt-3 border-t border-border/40">
        <Link
          href="/produits"
          className={cn(
            "flex items-center justify-center gap-1.5 w-full py-1.5",
            "text-xs font-medium text-primary",
            "hover:bg-primary/5 rounded-lg transition-colors"
          )}
        >
          Voir tous les produits
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}
