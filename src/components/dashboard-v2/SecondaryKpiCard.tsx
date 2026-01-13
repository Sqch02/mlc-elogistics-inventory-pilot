'use client'

import { motion } from 'framer-motion'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SecondaryKpiCardProps {
  label: string
  value: string | number
  subValue?: string
  icon: LucideIcon
  status?: 'default' | 'success' | 'warning' | 'danger'
  trend?: {
    value: number
    isPositive: boolean
  }
  delay?: number
}

const statusColors = {
  default: {
    accent: 'bg-primary',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    glow: ''
  },
  success: {
    accent: 'bg-success',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    glow: 'hover:glow-success'
  },
  warning: {
    accent: 'bg-warning',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    glow: 'hover:glow-warning'
  },
  danger: {
    accent: 'bg-error',
    iconBg: 'bg-error/10',
    iconColor: 'text-error',
    glow: 'hover:glow-error'
  }
}

export function SecondaryKpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  status = 'default',
  trend,
  delay = 0
}: SecondaryKpiCardProps) {
  const colors = statusColors[status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "relative bg-card rounded-xl border border-border/60",
        "p-5 shadow-sm hover:shadow-md transition-shadow duration-200",
        colors.glow
      )}
    >
      {/* Left accent bar */}
      <div className={cn("absolute left-0 top-4 bottom-4 w-[3px] rounded-full", colors.accent)} />

      {/* Icon badge */}
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2.5 rounded-lg", colors.iconBg)}>
          <Icon className={cn("h-5 w-5", colors.iconColor)} />
        </div>

        {/* Trend indicator */}
        {trend && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.2 }}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              trend.isPositive
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
          </motion.div>
        )}
      </div>

      {/* Value */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.1 }}
        className="space-y-1"
      >
        <p className="text-2xl font-semibold text-foreground tracking-tight">
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground/70">{subValue}</p>
        )}
      </motion.div>
    </motion.div>
  )
}
