'use client'

import { motion } from 'framer-motion'
import { Package, DollarSign, Truck, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { DashboardAlert } from '@/types/dashboard'

interface AlertsTimelineProps {
  alerts: DashboardAlert[]
  delay?: number
}

const alertConfig = {
  stock_critique: {
    icon: Package,
    color: 'text-error',
    bgColor: 'bg-error/10',
    dotColor: 'bg-error',
    lineColor: 'from-error to-error/50'
  },
  tarif_manquant: {
    icon: DollarSign,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    dotColor: 'bg-warning',
    lineColor: 'from-warning to-warning/50'
  },
  items_manquants: {
    icon: Truck,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    dotColor: 'bg-muted-foreground',
    lineColor: 'from-muted-foreground to-muted-foreground/50'
  },
  sync_echec: {
    icon: AlertTriangle,
    color: 'text-error',
    bgColor: 'bg-error/10',
    dotColor: 'bg-error',
    lineColor: 'from-error to-error/50'
  }
}

function AlertItem({ alert, index, isLast, delay }: {
  alert: DashboardAlert
  index: number
  isLast: boolean
  delay: number
}) {
  const config = alertConfig[alert.type]
  const Icon = config.icon
  const isCritical = alert.type === 'stock_critique' || alert.type === 'sync_echec'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay + index * 0.1, duration: 0.4 }}
      className="relative flex gap-4"
    >
      {/* Timeline line */}
      {!isLast && (
        <div className={cn(
          "absolute left-[15px] top-10 w-0.5 h-[calc(100%-8px)]",
          "bg-gradient-to-b",
          config.lineColor
        )} />
      )}

      {/* Dot */}
      <div className="relative z-10 shrink-0 mt-1">
        <span className={cn(
          "block w-[10px] h-[10px] rounded-full ring-4 ring-background",
          config.dotColor,
          isCritical && "pulse-dot"
        )} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
              <Icon className={cn("h-4 w-4", config.color)} />
            </div>
            <div>
              <h4 className="font-medium text-foreground">{alert.title}</h4>
              <p className="text-sm text-muted-foreground">{alert.description}</p>
            </div>
          </div>

          {/* Count badge */}
          {alert.count > 0 && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              config.bgColor,
              config.color
            )}>
              {alert.count}
            </span>
          )}
        </div>

        {/* Action link */}
        {alert.actionLink && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + index * 0.1 + 0.2 }}
          >
            <Link
              href={alert.actionLink}
              className={cn(
                "inline-flex items-center gap-1 mt-2 text-sm font-medium",
                "hover:gap-2 transition-all",
                config.color
              )}
            >
              {alert.actionLabel || 'Voir'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export function AlertsTimeline({ alerts, delay = 0 }: AlertsTimelineProps) {
  const hasAlerts = alerts.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-lg",
            hasAlerts ? "bg-warning/10" : "bg-success/10"
          )}>
            {hasAlerts ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <CheckCircle className="h-5 w-5 text-success" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Alertes</h3>
            <p className="text-sm text-muted-foreground">
              {hasAlerts
                ? `${alerts.length} action${alerts.length > 1 ? 's' : ''} requise${alerts.length > 1 ? 's' : ''}`
                : 'Aucune action requise'
              }
            </p>
          </div>
        </div>

        {hasAlerts && (
          <span className="px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
            {alerts.length}
          </span>
        )}
      </div>

      {/* Timeline or empty state */}
      {hasAlerts ? (
        <div className="space-y-0">
          {alerts.map((alert, index) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              index={index}
              isLast={index === alerts.length - 1}
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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.4, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4"
          >
            <CheckCircle className="h-8 w-8 text-success" />
          </motion.div>
          <h4 className="font-medium text-foreground mb-1">Tout est en ordre</h4>
          <p className="text-sm text-muted-foreground">
            Aucune action requise pour le moment
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
