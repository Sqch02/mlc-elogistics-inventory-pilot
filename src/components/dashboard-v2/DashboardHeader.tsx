'use client'

import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FloatingMonthSelector } from './FloatingMonthSelector'

interface DashboardHeaderProps {
  currentMonth: string
  onMonthChange: (month: string) => void
  lastSync?: {
    date: string | null
    status: 'ok' | 'warning' | 'failed'
  }
  isRefreshing?: boolean
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

function formatMonthTitle(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  return `${MONTHS_FR[monthNum - 1]} ${year}`
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export function DashboardHeader({
  currentMonth,
  onMonthChange,
  lastSync,
  isRefreshing
}: DashboardHeaderProps) {
  const greeting = getGreeting()
  const monthTitle = formatMonthTitle(currentMonth)

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
    >
      <div className="space-y-1">
        <motion.h1
          className="text-2xl font-semibold text-foreground tracking-tight"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          {greeting}
        </motion.h1>
        <motion.p
          className="text-muted-foreground flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <span>Vue d&apos;ensemble</span>
          <span className="text-border">•</span>
          <span className="font-medium text-foreground">{monthTitle}</span>

          {/* Sync status indicator */}
          {lastSync && (
            <>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                {isRefreshing ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                ) : (
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      lastSync.status === 'ok' && "bg-success",
                      lastSync.status === 'warning' && "bg-warning",
                      lastSync.status === 'failed' && "bg-error pulse-dot"
                    )}
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  {isRefreshing ? 'Actualisation...' : 'Synchronisé'}
                </span>
              </span>
            </>
          )}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <FloatingMonthSelector
          currentMonth={currentMonth}
          onMonthChange={onMonthChange}
        />
      </motion.div>
    </motion.header>
  )
}
