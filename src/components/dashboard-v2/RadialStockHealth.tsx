'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StockHealthItem } from '@/types/dashboard'

interface RadialStockHealthProps {
  stockHealth: StockHealthItem[]
  criticalCount: number
  delay?: number
}

interface RingProps {
  radius: number
  strokeWidth: number
  progress: number
  color: string
  delay: number
  glow?: boolean
}

function AnimatedRing({ radius, strokeWidth, progress, color, delay, glow }: RingProps) {
  const [isVisible, setIsVisible] = useState(false)
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <circle
      cx="90"
      cy="90"
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={isVisible ? strokeDashoffset : circumference}
      transform="rotate(-90 90 90)"
      className={cn(
        "transition-all duration-1000 ease-out",
        glow && "drop-shadow-[0_0_8px_rgba(197,48,48,0.5)]"
      )}
      style={{
        filter: glow ? 'drop-shadow(0 0 6px rgba(197, 48, 48, 0.6))' : undefined
      }}
    />
  )
}

export function RadialStockHealth({ stockHealth, criticalCount, delay = 0 }: RadialStockHealthProps) {
  // Calculate metrics
  const totalSkus = stockHealth.length > 0 ? Math.max(stockHealth.length * 3, 50) : 50 // Estimate total
  const warningCount = stockHealth.filter(s => s.daysRemaining >= 7 && s.daysRemaining < 14).length
  const criticalItems = stockHealth.filter(s => s.daysRemaining < 7)

  // Progress values (0-1)
  const totalProgress = 1 // Full circle for context
  const warningProgress = warningCount / Math.max(totalSkus, 1)
  const criticalProgress = criticalCount / Math.max(totalSkus, 1)

  const isHealthy = criticalCount === 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Santé du Stock</h3>
        {criticalCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.3, type: 'spring' }}
            className="px-2.5 py-1 rounded-full bg-error/10 text-error text-xs font-medium"
          >
            {criticalCount} critique{criticalCount > 1 ? 's' : ''}
          </motion.span>
        )}
      </div>

      {/* Radial visualization */}
      <div className="relative flex items-center justify-center py-4">
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Background rings (track) */}
          <circle
            cx="90"
            cy="90"
            r="75"
            fill="none"
            stroke="#E8E4DC"
            strokeWidth="8"
            strokeOpacity="0.5"
          />
          <circle
            cx="90"
            cy="90"
            r="58"
            fill="none"
            stroke="#E8E4DC"
            strokeWidth="8"
            strokeOpacity="0.3"
          />
          <circle
            cx="90"
            cy="90"
            r="41"
            fill="none"
            stroke="#E8E4DC"
            strokeWidth="8"
            strokeOpacity="0.2"
          />

          {/* Outer ring - Total (gray/success) */}
          <AnimatedRing
            radius={75}
            strokeWidth={8}
            progress={totalProgress}
            color={isHealthy ? '#2F855A' : '#6B6B6B'}
            delay={delay * 1000 + 400}
          />

          {/* Middle ring - Warning (amber) */}
          {warningCount > 0 && (
            <AnimatedRing
              radius={58}
              strokeWidth={8}
              progress={Math.min(warningProgress * 10, 1)} // Scale up for visibility
              color="#C77C14"
              delay={delay * 1000 + 600}
            />
          )}

          {/* Inner ring - Critical (red with glow) */}
          {criticalCount > 0 && (
            <AnimatedRing
              radius={41}
              strokeWidth={8}
              progress={Math.min(criticalProgress * 10, 1)} // Scale up for visibility
              color="#C53030"
              delay={delay * 1000 + 800}
              glow
            />
          )}
        </svg>

        {/* Center content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.5, duration: 0.3 }}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          {isHealthy ? (
            <>
              <CheckCircle className="h-8 w-8 text-success mb-1" />
              <span className="text-sm font-medium text-success">Tout va bien</span>
            </>
          ) : (
            <>
              <span className={cn(
                "text-3xl font-bold",
                criticalCount > 0 ? "text-error" : "text-warning"
              )}>
                {criticalCount}
              </span>
              <span className="text-sm text-muted-foreground">
                SKU{criticalCount > 1 ? 's' : ''} critique{criticalCount > 1 ? 's' : ''}
              </span>
            </>
          )}
        </motion.div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/40">
        <div className="text-center">
          <span className="block w-3 h-3 rounded-full bg-muted-foreground/50 mx-auto mb-1" />
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
        <div className="text-center">
          <span className="block w-3 h-3 rounded-full bg-warning mx-auto mb-1" />
          <span className="text-xs text-muted-foreground">Warning</span>
          <span className="block text-sm font-medium text-foreground">{warningCount}</span>
        </div>
        <div className="text-center">
          <span className={cn(
            "block w-3 h-3 rounded-full bg-error mx-auto mb-1",
            criticalCount > 0 && "pulse-dot"
          )} />
          <span className="text-xs text-muted-foreground">Critique</span>
          <span className="block text-sm font-medium text-foreground">{criticalCount}</span>
        </div>
      </div>

      {/* Quick list of critical items */}
      {criticalItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.7 }}
          className="mt-4 pt-3 border-t border-border/40"
        >
          <p className="text-xs text-muted-foreground mb-2">Articles critiques:</p>
          <div className="flex flex-wrap gap-1.5">
            {criticalItems.slice(0, 4).map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-full bg-error/10 text-error text-xs font-mono"
              >
                {item.sku}
              </span>
            ))}
            {criticalItems.length > 4 && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                +{criticalItems.length - 4}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
