'use client'

import { motion } from 'framer-motion'
import { Package, Banknote, AlertTriangle, Users, Building2, ArrowRight, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useHubDashboard, HubTenantMetrics } from '@/hooks/useHubDashboard'
import { useTenant } from '@/components/providers/TenantProvider'
import { SecondaryKpiCard } from './SecondaryKpiCard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function formatCost(value: number): string {
  return `${value.toFixed(2)} EUR`
}

function formatSyncDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "A l'instant"
  if (diffMin < 60) return `Il y a ${diffMin}min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `Il y a ${diffHours}h`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function HubSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] rounded-2xl" />
    </div>
  )
}

function TenantRow({ tenant, onNavigate }: { tenant: HubTenantMetrics; onNavigate: (id: string) => void }) {
  return (
    <TableRow className="group hover:bg-muted/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-medium text-sm">{tenant.name}</span>
            {tenant.code && (
              <Badge variant="muted" className="ml-2 text-[10px]">{tenant.code}</Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm">{tenant.userCount}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="font-mono text-sm font-medium">{tenant.shipments}</span>
      </TableCell>
      <TableCell>
        <span className="font-mono text-sm">{formatCost(tenant.cost)}</span>
      </TableCell>
      <TableCell>
        {tenant.missingPricing > 0 ? (
          <Badge variant="warning" className="text-xs">{tenant.missingPricing}</Badge>
        ) : (
          <Badge variant="success" className="text-xs">OK</Badge>
        )}
      </TableCell>
      <TableCell>
        {tenant.criticalStock > 0 ? (
          <Badge variant="error" className="text-xs">{tenant.criticalStock} SKU</Badge>
        ) : (
          <Badge variant="success" className="text-xs">OK</Badge>
        )}
      </TableCell>
      <TableCell>
        {tenant.lastSync ? (
          <div className="flex items-center gap-1.5">
            {tenant.lastSync.status === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {formatSyncDate(tenant.lastSync.date)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Jamais</span>
          </div>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(tenant.id)}
          className="gap-1 text-primary hover:text-primary"
        >
          Voir
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function HubDashboard() {
  const { data, isLoading } = useHubDashboard()
  const { setActiveTenantId } = useTenant()

  if (isLoading) {
    return <HubSkeleton />
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Erreur lors du chargement du hub
      </div>
    )
  }

  const { tenants, totals, month } = data
  const monthLabel = new Date(`${month}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Hub Operations</h1>
        <p className="text-muted-foreground text-sm">
          Vue d&apos;ensemble de tous vos clients - {monthLabel}
        </p>
      </div>

      {/* KPIs agreges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SecondaryKpiCard
          label="Expeditions totales"
          value={totals.shipments}
          subValue={`${tenants.length} client(s) actif(s)`}
          icon={Package}
          status="default"
          delay={0.1}
        />
        <SecondaryKpiCard
          label="Cout transport total"
          value={formatCost(totals.cost)}
          subValue="ce mois-ci"
          icon={Banknote}
          status="default"
          delay={0.15}
        />
        <SecondaryKpiCard
          label="Tarifs manquants"
          value={totals.missingPricing}
          subValue="tous clients"
          icon={AlertTriangle}
          status={totals.missingPricing > 0 ? 'warning' : 'success'}
          delay={0.2}
        />
        <SecondaryKpiCard
          label="Stock critique"
          value={totals.criticalStock}
          subValue="tous clients"
          icon={AlertTriangle}
          status={totals.criticalStock > 0 ? 'danger' : 'success'}
          delay={0.25}
        />
      </div>

      {/* Table des clients */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Card className="shadow-sm border-border overflow-hidden">
          <CardContent className="p-0">
            {tenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Building2 className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm font-medium">Aucun client configure</p>
                <p className="text-xs mt-1">Ajoutez des clients depuis le panneau admin</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Utilisateurs</TableHead>
                    <TableHead>Expeditions</TableHead>
                    <TableHead>Cout transport</TableHead>
                    <TableHead>Tarifs</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Sync</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TenantRow
                      key={tenant.id}
                      tenant={tenant}
                      onNavigate={setActiveTenantId}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
