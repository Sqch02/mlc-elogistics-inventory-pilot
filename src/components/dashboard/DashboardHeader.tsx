"use client"

import { Button } from "@/components/ui/button"
import { CalendarDays, RefreshCw, FileText, Upload } from "lucide-react"

interface DashboardHeaderProps {
  currentMonth: string
  lastSync?: {
    date: string | null
    status: 'ok' | 'warning' | 'failed'
  }
}

export function DashboardHeader({ currentMonth, lastSync }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble – {new Date(currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {lastSync && (
          <div className="flex items-center gap-2 mr-4 text-sm text-muted-foreground hidden lg:flex">
            <span className={`w-2 h-2 rounded-full ${
              lastSync.status === 'ok' ? 'bg-green-500' :
              lastSync.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            <span>Dernière sync: {lastSync.date ? new Date(lastSync.date).toLocaleString('fr-FR') : 'Jamais'}</span>
          </div>
        )}
        
        <Button variant="outline" size="sm" className="h-9">
          <CalendarDays className="mr-2 h-4 w-4" />
          {new Date(currentMonth).toLocaleDateString('fr-FR', { month: 'long' })}
        </Button>
        
        <Button variant="outline" size="sm" className="h-9">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Sendcloud
        </Button>

        <Button variant="outline" size="sm" className="h-9">
          <FileText className="mr-2 h-4 w-4" />
          Facture
        </Button>

        <Button variant="outline" size="sm" className="h-9">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </div>
    </div>
  )
}

