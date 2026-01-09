"use client"

import { cn } from "@/lib/utils"

interface DashboardHeaderProps {
  currentMonth: string
  lastSync?: {
    date: string | null
    status: 'ok' | 'warning' | 'failed'
  }
}

export function DashboardHeader({ currentMonth, lastSync }: DashboardHeaderProps) {
  const monthLabel = new Date(currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
      <div className="flex items-center gap-3 mt-1">
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble - {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </p>
        {lastSync && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-muted-foreground/40">|</span>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              lastSync.status === 'ok' ? 'bg-success' :
              lastSync.status === 'warning' ? 'bg-warning' : 'bg-error'
            )} />
            <span>
              {lastSync.date
                ? `Sync ${new Date(lastSync.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Non synchronise'
              }
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
