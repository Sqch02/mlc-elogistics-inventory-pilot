'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Package, TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface HeroMetricCardProps {
  value: number
  label: string
  subLabel?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  sparklineData?: { value: number }[]
  delay?: number
}

// Custom hook for animated counting
function useCountUp(end: number, duration: number = 1500, delay: number = 0) {
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp
        const progress = Math.min((timestamp - startTimeRef.current) / duration, 1)

        // Easing function (ease-out-cubic)
        const eased = 1 - Math.pow(1 - progress, 3)
        const currentCount = Math.floor(eased * end)

        if (currentCount !== countRef.current) {
          countRef.current = currentCount
          setCount(currentCount)
        }

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setCount(end)
        }
      }

      requestAnimationFrame(animate)
    }, delay)

    return () => clearTimeout(timeout)
  }, [end, duration, delay])

  return count
}

// Format number with spaces for thousands
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function HeroMetricCard({
  value,
  label,
  subLabel,
  trend,
  sparklineData,
  delay = 0
}: HeroMetricCardProps) {
  const animatedValue = useCountUp(value, 1500, delay + 200)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className={cn(
        "relative bg-card rounded-2xl border border-border/60",
        "p-6 lg:p-8 shadow-sm overflow-hidden",
        "mesh-bg border-pulse"
      )}
    >
      {/* Icon badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.1, duration: 0.3 }}
        className="glass-dark inline-flex p-3 rounded-xl mb-6"
      >
        <Package className="h-6 w-6 text-primary" />
      </motion.div>

      {/* Main content */}
      <div className="space-y-4">
        {/* Animated counter */}
        <div className="space-y-1">
          <motion.p
            className="text-5xl lg:text-6xl font-bold text-primary tracking-tight tabular-nums"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
          >
            {formatNumber(animatedValue)}
          </motion.p>
          <p className="text-lg text-foreground font-medium">{label}</p>
          {subLabel && (
            <p className="text-sm text-muted-foreground">{subLabel}</p>
          )}
        </div>

        {/* Trend and sparkline row */}
        <div className="flex items-end justify-between gap-4 pt-2">
          {/* Trend badge */}
          {trend && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.4 }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                trend.isPositive
                  ? "bg-success/10 text-success"
                  : "bg-error/10 text-error"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{trend.isPositive ? '+' : ''}{trend.value}% vs mois dernier</span>
            </motion.div>
          )}

          {/* Mini sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.5 }}
              className="w-32 h-12"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id="heroSparkline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1B4D3E" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#1B4D3E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#1B4D3E"
                    strokeWidth={2}
                    fill="url(#heroSparkline)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>
      </div>

      {/* Decorative gradient orb */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
    </motion.div>
  )
}
