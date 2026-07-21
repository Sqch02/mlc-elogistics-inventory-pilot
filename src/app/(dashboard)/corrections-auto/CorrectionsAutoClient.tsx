'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTenant } from '@/components/providers/TenantProvider'
import { SecondaryKpiCard } from '@/components/dashboard-v2/SecondaryKpiCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  AUTO_FIX_ACTION_LABELS,
  AUTO_FIX_PATTERN_LABELS,
  AUTO_FIX_STATE_LABELS,
} from '@/lib/auto-fix/dashboard-labels'
import type {
  AutoFixAuditPage,
  AutoFixAuditItem,
  AutoFixDashboardResponse,
  AutoFixGateView,
} from '@/lib/auto-fix/dashboard-types'
import { AUTO_FIX_JOB_STATES, type AutoFixAction } from '@/lib/auto-fix/types'
import type { Json } from '@/types/database'

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatDate(value: string): string {
  return DATE_FORMAT.format(new Date(value))
}

async function fetchDashboard(cursor?: string): Promise<AutoFixDashboardResponse | AutoFixAuditPage> {
  const params = new URLSearchParams({ limit: '25' })
  if (cursor) params.set('cursor', cursor)
  const endpoint = cursor ? '/api/auto-fix/dashboard/audits' : '/api/auto-fix/dashboard'
  const response = await fetch(`${endpoint}?${params}`, { cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? 'Impossible de charger les corrections automatiques')
  }
  return response.json() as Promise<AutoFixDashboardResponse | AutoFixAuditPage>
}

function gateLabel(gate: AutoFixGateView): { label: string; detail: string } {
  const values: Record<AutoFixGateView['effective'], { label: string; detail: string }> = {
    global_paused: {
      label: 'Pause globale active',
      detail: 'Le kill-switch bloque la détection et le worker.',
    },
    dry_run_disabled: {
      label: 'Simulation désactivée',
      detail: 'Le flag de dry-run est fermé.',
    },
    tenant_off: {
      label: 'Tenant désactivé',
      detail: 'Le mode du tenant est sur off.',
    },
    simulated: {
      label: 'Simulation active',
      detail: 'La détection peut produire des plans, sans les appliquer.',
    },
    live_ignored: {
      label: 'Mode live ignoré',
      detail: 'Cette fondation dry-run ne possède aucune capacité d’écriture.',
    },
  }
  return values[gate.effective]
}

function GateBanner({ gate }: { gate: AutoFixGateView }) {
  const effective = gateLabel(gate)
  const isSimulated = gate.effective === 'simulated'
  return (
    <Card className="overflow-hidden border-[#C9A227]/35 bg-gradient-to-r from-[#FFF9E5] via-white to-white">
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-[#C9A227]/15 p-3 text-[#8B7118]">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-primary">DRY-RUN — observation uniquement</h2>
              <Badge variant="gold">Zéro écriture Sendcloud</Badge>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Les corrections affichées sont des simulations. Cette page ne peut ni modifier un colis,
              ni consommer du stock, ni activer le moteur.
            </p>
          </div>
        </div>
        <div className="min-w-[220px] rounded-lg border border-border/60 bg-white/80 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">État effectif</span>
            <Badge variant={isSimulated ? 'success' : 'muted'}>{effective.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{effective.detail}</p>
        </div>
      </div>
      <div className="grid border-t border-[#C9A227]/20 bg-white/60 sm:grid-cols-3">
        <GateFlag label="AUTO_FIX_PAUSED" value={gate.globalPaused ? 'fermé' : 'ouvert'} safe={gate.globalPaused} />
        <GateFlag label="AUTO_FIX_DRY_RUN_ENABLED" value={gate.dryRunEnabled ? 'ouvert' : 'fermé'} safe={!gate.dryRunEnabled} />
        <GateFlag label="Mode tenant" value={gate.tenantMode} safe={gate.tenantMode !== 'live'} />
      </div>
    </Card>
  )
}

function GateFlag({ label, value, safe }: { label: string; value: string; safe: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-[#C9A227]/15 px-5 py-3 not-last:border-b sm:not-last:border-b-0 sm:not-last:border-r">
      <span className="truncate font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold', safe ? 'text-success' : 'text-[#8B7118]')}>{value}</span>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">
        <ClipboardList className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function PatternCard({ data }: { data: AutoFixDashboardResponse }) {
  const max = Math.max(...data.patterns.map((item) => item.count), 1)
  const nonEmpty = data.patterns.filter((item) => item.count > 0)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Patterns détectés</CardTitle>
            <CardDescription className="mt-1">Répartition des causes reconnues dans l’échantillon borné.</CardDescription>
          </div>
          <Badge variant="outline">{data.patternSample.sampledJobs} job(s)</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {nonEmpty.length === 0 ? (
          <EmptyState title="Aucun pattern détecté" description="Les compteurs apparaîtront après le premier passage en simulation." />
        ) : (
          <div className="space-y-4">
            {nonEmpty.map((item) => (
              <div key={item.pattern}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{AUTO_FIX_PATTERN_LABELS[item.pattern]}</span>
                  <span className="tabular-nums text-muted-foreground">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={cn('h-full rounded-full', item.pattern === 'unknown' ? 'bg-error' : 'bg-primary')}
                    style={{ width: `${Math.max((item.count / max) * 100, 3)}%` }}
                  />
                </div>
              </div>
            ))}
            {data.patternSample.truncated && (
              <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                Répartition calculée sur {data.patternSample.sampledJobs} jobs récents sur {data.patternSample.totalJobs}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StateCard({ data }: { data: AutoFixDashboardResponse }) {
  const visibleStates = AUTO_FIX_JOB_STATES.filter((state) => data.jobsByState[state] > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobs par état</CardTitle>
        <CardDescription>Vue exacte de la machine à états pour le tenant actif.</CardDescription>
      </CardHeader>
      <CardContent>
        {visibleStates.length === 0 ? (
          <EmptyState title="Aucun job" description="La file est vide. C’est l’état attendu avant l’activation du dry-run sur ce tenant." />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AUTO_FIX_JOB_STATES.map((state) => (
              <div key={state} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">{AUTO_FIX_STATE_LABELS[state]}</span>
                <span className="font-semibold tabular-nums">{data.jobsByState[state]}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function actionVariant(action: AutoFixAction): 'info' | 'warning' | 'gold' | 'muted' {
  if (action === 'manual_required') return 'warning'
  if (action === 'account_configuration') return 'gold'
  if (action === 'none') return 'muted'
  return 'info'
}

function ManualCard({ data }: { data: AutoFixDashboardResponse }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Interventions manuelles</CardTitle>
            <CardDescription className="mt-1">
              États manuels réels et simulations dont le plan aboutirait à une intervention.
            </CardDescription>
          </div>
          <Badge variant={data.manualItems.length > 0 ? 'warning' : 'muted'}>{data.manualItems.length} visible(s)</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {data.manualItems.length === 0 ? (
          <EmptyState title="Aucune intervention en attente" description="Les causes non corrigeables apparaîtront ici avec leur motif." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Détection</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Action prévue</TableHead>
                <TableHead className="pr-6 text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.manualItems.map((item) => (
                <TableRow key={`${item.kind}-${item.id}`}>
                  <TableCell className="pl-6">
                    <div className="space-y-1">
                      <div className="font-medium">{AUTO_FIX_PATTERN_LABELS[item.primaryPattern]}</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={item.kind === 'current' ? 'warning' : 'gold'}>
                          {item.kind === 'current' ? 'Réel' : 'Prévision dry-run'}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">#{item.sourceSendcloudId}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal text-muted-foreground">{item.reason}</TableCell>
                  <TableCell><Badge variant={actionVariant(item.action)}>{AUTO_FIX_ACTION_LABELS[item.action]}</Badge></TableCell>
                  <TableCell className="pr-6 text-right text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function JsonPanel({ label, value }: { label: string; value: Json | null }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-background">
      <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      {value === null ? (
        <p className="p-4 text-sm text-muted-foreground">Aucune donnée</p>
      ) : (
        <pre className="max-h-72 overflow-auto p-4 text-xs leading-relaxed text-foreground">{JSON.stringify(value, null, 2)}</pre>
      )}
    </div>
  )
}

function AuditRow({ audit }: { audit: AutoFixAuditItem }) {
  const hasPlanDiff = audit.before !== null || audit.after !== null
  return (
    <TableRow className="h-auto align-top hover:bg-transparent">
      <TableCell colSpan={5} className="p-0">
        <details className="group">
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(170px,1fr)_150px_32px] items-center gap-4 px-6 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 [&::-webkit-details-marker]:hidden">
            <div>
              <div className="font-medium">{AUTO_FIX_PATTERN_LABELS[audit.primaryPattern]}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">#{audit.sourceSendcloudId}</div>
            </div>
            <div><Badge variant={actionVariant(audit.action)}>{AUTO_FIX_ACTION_LABELS[audit.action]}</Badge></div>
            <div className="flex flex-wrap gap-1">
              {audit.detectedPatterns.map((pattern) => (
                <Badge key={pattern} variant={pattern === 'unknown' ? 'error' : 'outline'}>{AUTO_FIX_PATTERN_LABELS[pattern]}</Badge>
              ))}
            </div>
            <div className="text-right text-xs text-muted-foreground">{formatDate(audit.createdAt)}</div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-border/40 bg-muted/20 px-6 py-5">
            {audit.piiRedactedAt && (
              <p className="mb-3 text-xs text-muted-foreground">Les données personnelles de cet audit ont été purgées.</p>
            )}
            {hasPlanDiff ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <JsonPanel label="Avant" value={audit.before} />
                <JsonPanel label="Après / plan simulé" value={audit.after} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun diff n’a été enregistré pour cette simulation.</p>
            )}
          </div>
        </details>
      </TableCell>
    </TableRow>
  )
}

function AuditCard({ audits, hasNextPage, isFetchingNextPage, onLoadMore }: {
  audits: AutoFixAuditItem[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Historique des simulations</CardTitle>
            <CardDescription className="mt-1">Audits simulated, plans et différences avant/après. 25 lignes par page.</CardDescription>
          </div>
          <Badge variant="gold"><Sparkles className="mr-1 h-3 w-3" />Simulated uniquement</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {audits.length === 0 ? (
          <EmptyState title="Aucun audit simulé" description="L’historique se remplira après le premier traitement dry-run." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[850px]">
                <div className="grid grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(170px,1fr)_150px_32px] gap-4 border-y border-border/50 bg-muted/30 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Pattern</span><span>Action planifiée</span><span>Causes</span><span className="text-right">Date</span><span />
                </div>
                <Table>
                  <TableBody>{audits.map((audit) => <AuditRow key={audit.id} audit={audit} />)}</TableBody>
                </Table>
              </div>
            </div>
            {hasNextPage && (
              <div className="flex justify-center border-t border-border/50 p-4">
                <Button variant="outline" onClick={onLoadMore} disabled={isFetchingNextPage}>
                  <RefreshCw className={cn('h-4 w-4', isFetchingNextPage && 'animate-spin')} />
                  {isFetchingNextPage ? 'Chargement…' : 'Afficher 25 audits de plus'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return <div className="space-y-6"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>
}

export function CorrectionsAutoClient() {
  const { activeTenantId, activeTenant, isLoading: tenantLoading } = useTenant()
  const query = useInfiniteQuery({
    queryKey: ['auto-fix-dashboard', activeTenantId],
    queryFn: ({ pageParam }) => fetchDashboard(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
    enabled: Boolean(activeTenantId) && !tenantLoading,
    staleTime: 15_000,
  })

  const initialPage = query.data?.pages[0]
  const firstPage = initialPage && 'gate' in initialPage ? initialPage : undefined
  const audits = query.data?.pages.flatMap((page) => page.audits) ?? []

  if (tenantLoading || query.isLoading) return <DashboardSkeleton />
  if (query.isError || !firstPage) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-error" />
        <h1 className="text-lg font-semibold">Chargement impossible</h1>
        <p className="mt-2 text-sm text-muted-foreground">{query.error?.message ?? 'Aucune donnée reçue.'}</p>
        <Button className="mx-auto mt-5" variant="outline" onClick={() => query.refetch()}>
          <RefreshCw className="h-4 w-4" />Réessayer
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Corrections automatiques</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Observabilité dry-run{activeTenant?.name ? ` · ${activeTenant.name}` : ''} · actualisé le {formatDate(firstPage.generatedAt)}
          </p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} />
          Actualiser
        </Button>
      </div>

      <GateBanner gate={firstPage.gate} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SecondaryKpiCard
          label="Jobs détectés"
          value={firstPage.kpis.totalJobs}
          subValue="tous états confondus"
          icon={Activity}
          tooltip="Comptage exact des jobs de ce tenant, sans lire la table shipments."
        />
        <SecondaryKpiCard
          label="Simulés"
          value={firstPage.kpis.simulated}
          subValue={`${firstPage.kpis.simulatedRate}% du couple simulé / manuel`}
          icon={Sparkles}
          status="success"
        />
        <SecondaryKpiCard
          label="À traiter manuellement"
          value={firstPage.kpis.pendingManual}
          subValue={`${firstPage.kpis.manualForecast} prévision(s) dans les simulations récentes`}
          icon={Clock3}
          status={firstPage.kpis.pendingManual > 0 || firstPage.kpis.manualForecast > 0 ? 'warning' : 'default'}
        />
        <SecondaryKpiCard
          label="Causes inconnues"
          value={firstPage.kpis.unknown}
          subValue="dans l’échantillon récent"
          icon={CircleHelp}
          status={firstPage.kpis.unknown > 0 ? 'danger' : 'success'}
          tooltip="Nombre de causes inconnues dans l’échantillon borné utilisé pour les patterns, afin d’éviter un scan non indexé."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StateCard data={firstPage} />
        <PatternCard data={firstPage} />
      </div>

      <ManualCard data={firstPage} />
      <AuditCard
        audits={audits}
        hasNextPage={Boolean(query.hasNextPage)}
        isFetchingNextPage={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
        Requêtes bornées et scopées au tenant actif · aucune lecture de shipments
      </div>
    </div>
  )
}
