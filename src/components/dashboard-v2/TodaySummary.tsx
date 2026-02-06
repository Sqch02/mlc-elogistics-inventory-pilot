'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Package, AlertTriangle, Clock, ArrowRight, Sun, Euro,
  AlertCircle, BoxIcon, CalendarDays, ChevronLeft, ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTenant } from '@/components/providers/TenantProvider'

interface TodayData {
  shipments: {
    today: number
    cost: number
  }
  claims: {
    today: number
    yesterday: number
    open: Array<{
      id: string
      order_ref: string
      status: string
      priority: string
      resolution_deadline: string | null
      opened_at: string
    }>
    overdue: number
  }
  stock: {
    critical: Array<{
      sku_id: string
      sku_code: string
      name: string
      qty: number
    }>
  }
}

async function fetchTodaySummary(date: string): Promise<TodayData> {
  const res = await fetch(`/api/dashboard/today?date=${date}`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  return dateStr === today
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export function TodaySummary() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])

  const { data, isLoading } = useQuery({
    queryKey: ['today-summary', selectedDate],
    queryFn: () => fetchTodaySummary(selectedDate),
    refetchInterval: isToday(selectedDate) ? 60000 : false, // Only auto-refresh for today
  })

  const goToPrevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const goToNextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    const today = new Date().toISOString().split('T')[0]
    if (d.toISOString().split('T')[0] <= today) {
      setSelectedDate(d.toISOString().split('T')[0])
    }
  }

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  const { isClient } = useTenant()

  if (!data) return null

  const hasUrgentItems = data.claims.overdue > 0 || data.claims.open.some(c => c.priority === 'urgent')
  const hasCriticalStock = data.stock.critical.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`border-2 ${hasUrgentItems ? 'border-amber-300 bg-amber-50/50' : 'border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-amber-500" />
              {isToday(selectedDate) ? 'Ma journée' : 'Historique'}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={goToPrevDay}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={goToToday}
                className="flex items-center gap-1.5 px-2 py-1 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="capitalize">{formatDateForDisplay(selectedDate)}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={goToNextDay}
                disabled={isToday(selectedDate)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Today's Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/80 rounded-xl p-3 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Package className="h-3.5 w-3.5" />
                Expéditions
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{data.shipments.today}</span>
                {!isClient && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Euro className="h-3 w-3" />
                    {data.shipments.cost.toFixed(0)} €
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{isToday(selectedDate) ? "aujourd'hui" : 'ce jour'}</div>
            </div>
            <div className="bg-white/80 rounded-xl p-3 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Réclamations
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{data.claims.today}</span>
                {data.claims.overdue > 0 && (
                  <Badge variant="error" className="text-[10px]">
                    {data.claims.overdue} en retard
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{isToday(selectedDate) ? "aujourd'hui" : 'ce jour'}</div>
            </div>
            <div className={`rounded-xl p-3 border ${data.claims.yesterday > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white/80 border-border/50'}`}>
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Clock className="h-3.5 w-3.5" />
                Réclamations
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${data.claims.yesterday > 0 ? 'text-amber-600' : ''}`}>
                  {data.claims.yesterday}
                </span>
                {data.claims.yesterday > 0 && (
                  <Badge variant="warning" className="text-[10px]">
                    veille
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">veille</div>
            </div>
          </div>

          {/* Urgent Items */}
          {(data.claims.open.length > 0 || hasCriticalStock) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                À traiter
              </div>

              {/* Open Claims */}
              {data.claims.open.slice(0, 3).map((claim) => (
                <Link
                  key={claim.id}
                  href={`/reclamations?search=${encodeURIComponent(claim.order_ref || '')}`}
                  className="flex items-center justify-between p-2 bg-white/80 rounded-lg border border-border/50 hover:bg-white transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${getPriorityColor(claim.priority)}`}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{claim.order_ref || 'Sans référence'}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {claim.status === 'ouverte' ? 'Ouverte' : 'En analyse'}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              ))}

              {/* Critical Stock */}
              {data.stock.critical.slice(0, 2).map((item) => (
                <Link
                  key={item.sku_id}
                  href={`/produits?search=${encodeURIComponent(item.sku_code)}`}
                  className="flex items-center justify-between p-2 bg-white/80 rounded-lg border border-border/50 hover:bg-white transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-red-100 text-red-700">
                      <BoxIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{item.sku_code}</div>
                      <div className="text-xs text-muted-foreground">
                        Stock critique: {item.qty} unités
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              ))}

              {/* See more links */}
              <div className="flex gap-2 pt-1">
                {data.claims.open.length > 3 && (
                  <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                    <Link href="/reclamations?status=ouverte">
                      +{data.claims.open.length - 3} réclamations
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                )}
                {data.stock.critical.length > 2 && (
                  <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                    <Link href="/produits">
                      +{data.stock.critical.length - 2} alertes stock
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* All good message */}
          {data.claims.open.length === 0 && !hasCriticalStock && (
            <div className="text-center py-4 text-muted-foreground">
              <div className="text-2xl mb-1">✨</div>
              <div className="text-sm">Tout est en ordre !</div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
