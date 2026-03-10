'use client'

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
    <header
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 slide-down"
    >
      <div className="space-y-1">
        <h1
          className="text-2xl font-semibold text-foreground tracking-tight animate-fade-in-left"
          style={{ animationDelay: '0.1s' }}
        >
          {greeting}
        </h1>
        <p
          className="text-muted-foreground flex items-center gap-2 animate-fade-in-left"
          style={{ animationDelay: '0.2s' }}
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
        </p>
      </div>

      <div
        className="animate-fade-in"
        style={{ animationDelay: '0.3s' }}
      >
        <FloatingMonthSelector
          currentMonth={currentMonth}
          onMonthChange={onMonthChange}
        />
      </div>
    </header>
  )
}
