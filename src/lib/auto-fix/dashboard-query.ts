import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import {
  AUTO_FIX_ACTIONS,
  AUTO_FIX_JOB_STATES,
  AUTO_FIX_PATTERNS,
  type AutoFixAction,
  type AutoFixJobState,
  type AutoFixPattern,
  type AutoFixSourceKind,
} from './types'
import type {
  AutoFixAuditPage,
  AutoFixAuditItem,
  AutoFixDashboardResponse,
  AutoFixGateView,
  AutoFixManualItem,
  AutoFixTenantMode,
} from './dashboard-types'

const STATE_SAMPLE_LIMIT = 250
const MANUAL_LIST_LIMIT = 25

const JOB_SAMPLE_COLUMNS = 'id,primary_pattern,detected_patterns,source_kind,source_sendcloud_id,plan_json,created_at'

const AUDIT_COLUMNS = 'id,job_id,primary_pattern,detected_patterns,source_kind,source_sendcloud_id,action,status,before_json,after_json,pii_redacted_at,created_at'

interface DashboardOptions {
  auditLimit: number
  auditCursor?: string
}

type AutoFixClient = SupabaseClient<Database>

export async function readAutoFixAuditPage(
  readClient: AutoFixClient,
  tenantId: string,
  options: DashboardOptions,
): Promise<AutoFixAuditPage> {
  let query = readClient
    .from('auto_fixes')
    .select(AUDIT_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('status', 'simulated')
  if (options.auditCursor) query = query.lt('created_at', options.auditCursor)

  const result = await query
    .order('created_at', { ascending: false })
    .limit(options.auditLimit + 1)
  if (result.error) throw new Error(`auto_fixes/simulated: ${result.error.message}`)

  const rawRows = result.data ?? []
  const hasNextPage = rawRows.length > options.auditLimit
  const pageRows = hasNextPage ? rawRows.slice(0, options.auditLimit) : rawRows
  const audits: AutoFixAuditItem[] = pageRows.map((row) => ({
    id: row.id,
    jobId: row.job_id,
    primaryPattern: primaryPattern(row.primary_pattern),
    detectedPatterns: patterns(row.detected_patterns),
    sourceKind: sourceKind(row.source_kind),
    sourceSendcloudId: row.source_sendcloud_id,
    action: AUTO_FIX_ACTIONS.includes(row.action as AutoFixAction)
      ? row.action as AutoFixAction
      : 'none',
    status: 'simulated',
    before: row.before_json,
    after: row.after_json,
    piiRedactedAt: row.pii_redacted_at,
    createdAt: row.created_at,
  }))

  return {
    audits,
    pagination: {
      limit: options.auditLimit,
      nextCursor: hasNextPage && audits.length > 0 ? audits[audits.length - 1].createdAt : null,
    },
  }
}

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isPattern(value: string): value is AutoFixPattern {
  return AUTO_FIX_PATTERNS.includes(value as AutoFixPattern)
}

function patterns(values: string[] | null | undefined): AutoFixPattern[] {
  return (values ?? []).filter(isPattern)
}

function actionFromPlan(value: Json | null): AutoFixAction {
  if (!isRecord(value) || typeof value.action !== 'string') return 'none'
  return AUTO_FIX_ACTIONS.includes(value.action as AutoFixAction)
    ? value.action as AutoFixAction
    : 'none'
}

function sourceKind(value: string): AutoFixSourceKind {
  return value === 'integration_shipment' ? 'integration_shipment' : 'parcel'
}

function primaryPattern(value: string): AutoFixPattern {
  return isPattern(value) ? value : 'unknown'
}

function isManualForecast(plan: Json | null): boolean {
  return isRecord(plan) && plan.wouldEndState === 'pending_manual'
}

function manualReason(plan: Json | null, pattern: AutoFixPattern): string {
  if (isRecord(plan) && Array.isArray(plan.warnings)) {
    const warning = plan.warnings.find((item): item is string => typeof item === 'string' && item.length > 0)
    if (warning) return warning
  }
  const reasons: Record<AutoFixPattern, string> = {
    currency_chf: 'Conversion CHF bloquée tant que le taux et les arrondis ne sont pas validés.',
    address_too_long: 'Adresse à raccourcir avant annonce transporteur.',
    hs_code_missing: 'Configuration douanière incomplète.',
    weight_too_low: 'Poids article inférieur au minimum accepté.',
    service_point_missing: 'Aucun point relais compatible sélectionné.',
    sender_eori_missing: 'EORI expéditeur à configurer dans le compte Sendcloud.',
    unknown: 'Cause structurée non reconnue par les détecteurs.',
  }
  return reasons[pattern]
}

function gateView(
  mode: AutoFixTenantMode,
  env: Readonly<Record<string, string | undefined>>,
): AutoFixGateView {
  const globalPaused = env.AUTO_FIX_PAUSED !== 'false'
  const dryRunEnabled = env.AUTO_FIX_DRY_RUN_ENABLED === 'true'
  let effective: AutoFixGateView['effective']
  if (globalPaused) effective = 'global_paused'
  else if (!dryRunEnabled) effective = 'dry_run_disabled'
  else if (mode === 'off') effective = 'tenant_off'
  else if (mode === 'simulated') effective = 'simulated'
  else effective = 'live_ignored'
  return { globalPaused, dryRunEnabled, tenantMode: mode, effective }
}

function rate(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}

export async function readAutoFixDashboard(
  readClient: AutoFixClient,
  settingsClient: AutoFixClient,
  tenantId: string,
  options: DashboardOptions,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<AutoFixDashboardResponse> {
  const stateQueries = AUTO_FIX_JOB_STATES.map((state) => readClient
    .from('auto_fix_jobs')
    .select(JOB_SAMPLE_COLUMNS, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('state', state)
    .order('created_at', { ascending: false })
    .limit(STATE_SAMPLE_LIMIT))

  const [stateResults, auditPage, settingsResult] = await Promise.all([
    Promise.all(stateQueries),
    readAutoFixAuditPage(readClient, tenantId, options),
    settingsClient
      .from('tenant_settings')
      .select('auto_fix_mode')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ])

  const jobsByState = Object.fromEntries(
    AUTO_FIX_JOB_STATES.map((state) => [state, 0]),
  ) as Record<AutoFixJobState, number>
  const stateSamples = new Map<AutoFixJobState, NonNullable<(typeof stateResults)[number]['data']>>()
  let sampledJobs = 0
  let sampleTruncated = false

  stateResults.forEach((result, index) => {
    const state = AUTO_FIX_JOB_STATES[index]
    if (result.error) throw new Error(`auto_fix_jobs/${state}: ${result.error.message}`)
    const rows = result.data ?? []
    const count = result.count ?? rows.length
    jobsByState[state] = count
    stateSamples.set(state, rows)
    sampledJobs += rows.length
    if (count > rows.length) sampleTruncated = true
  })

  if (settingsResult.error) throw new Error(`tenant_settings/auto_fix_mode: ${settingsResult.error.message}`)

  const patternCounts = new Map<AutoFixPattern, number>(
    AUTO_FIX_PATTERNS.map((pattern) => [pattern, 0]),
  )
  for (const rows of stateSamples.values()) {
    for (const row of rows) {
      for (const pattern of patterns(row.detected_patterns)) {
        patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1)
      }
    }
  }

  const toManualItem = (
    row: NonNullable<(typeof stateResults)[number]['data']>[number],
    state: AutoFixJobState,
    kind: AutoFixManualItem['kind'],
  ): AutoFixManualItem => {
    const pattern = primaryPattern(row.primary_pattern)
    return {
      id: row.id,
      state,
      kind,
      primaryPattern: pattern,
      detectedPatterns: patterns(row.detected_patterns),
      sourceKind: sourceKind(row.source_kind),
      sourceSendcloudId: row.source_sendcloud_id,
      action: actionFromPlan(row.plan_json),
      reason: manualReason(row.plan_json, pattern),
      createdAt: row.created_at,
    }
  }

  const currentManual = (stateSamples.get('pending_manual') ?? [])
    .map((row) => toManualItem(row, 'pending_manual', 'current'))
  const forecastManual = (stateSamples.get('simulated') ?? [])
    .filter((row) => isManualForecast(row.plan_json))
    .map((row) => toManualItem(row, 'simulated', 'simulated_forecast'))
  const manualItems = [...currentManual, ...forecastManual]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MANUAL_LIST_LIMIT)

  const tenantMode = settingsResult.data?.auto_fix_mode
  const safeMode: AutoFixTenantMode = tenantMode === 'simulated' || tenantMode === 'live'
    ? tenantMode
    : 'off'
  const totalJobs = Object.values(jobsByState).reduce((sum, count) => sum + count, 0)
  const rateTotal = jobsByState.simulated + jobsByState.pending_manual

  return {
    generatedAt: new Date().toISOString(),
    gate: gateView(safeMode, env),
    kpis: {
      totalJobs,
      simulated: jobsByState.simulated,
      pendingManual: jobsByState.pending_manual,
      manualForecast: forecastManual.length,
      // No primary_pattern-only count query: the existing index is tenant/state,
      // so unknown follows the same bounded recent sample as pattern distribution.
      unknown: patternCounts.get('unknown') ?? 0,
      simulatedRate: rate(jobsByState.simulated, rateTotal),
      pendingManualRate: rate(jobsByState.pending_manual, rateTotal),
    },
    jobsByState,
    patterns: [...patternCounts.entries()]
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((left, right) => right.count - left.count),
    patternSample: { sampledJobs, totalJobs, truncated: sampleTruncated },
    manualItems,
    audits: auditPage.audits,
    pagination: auditPage.pagination,
  }
}
