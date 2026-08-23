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

const JOB_SAMPLE_COLUMNS = 'id,primary_pattern,detected_patterns,source_kind,source_sendcloud_id,plan_json,last_error_json,created_at'

// Le numero de commande vient de la table shipments : l'audit ne stocke qu'un
// identifiant technique, et un exploitant ne reconnait pas un UUID. Sans lui,
// impossible de relier une correction a la commande qu'on a sous les yeux.
const AUDIT_COLUMNS = 'id,job_id,primary_pattern,detected_patterns,source_kind,source_sendcloud_id,action,status,before_json,after_json,pii_redacted_at,created_at,source_order_ref,shipments(order_ref)'

// Etats reellement affiches. La version d'origine ne montrait QUE 'simulated' :
// une correction reellement appliquee n'apparaissait donc nulle part, et
// l'exploitant n'avait aucun moyen de savoir ce que l'outil avait fait.
const AUDIT_STATUSES = ['simulated', 'applied', 'verified', 'applied_unverified'] as const

/** Le numero de commande, quand la jointure a pu le fournir. */
function orderRefOf(row: unknown): string | null {
  const objet = (v: unknown): v is Record<string, unknown> =>
    Boolean(v) && typeof v === 'object' && !Array.isArray(v)

  if (!objet(row)) return null
  // La colonne d'abord : elle survit au remplacement de la ligne d'expedition.
  if (typeof row.source_order_ref === 'string' && row.source_order_ref) return row.source_order_ref
  const lien = row.shipments
  // PostgREST renvoie un objet ou un tableau selon la cardinalite declaree :
  // on accepte les deux plutot que de dependre de la forme.
  if (objet(lien) && typeof lien.order_ref === 'string') return lien.order_ref
  if (Array.isArray(lien) && objet(lien[0]) && typeof lien[0].order_ref === 'string') {
    return lien[0].order_ref
  }
  return null
}

function auditStatus(value: unknown): AutoFixAuditItem['status'] {
  return (AUDIT_STATUSES as readonly string[]).includes(String(value))
    ? (value as AutoFixAuditItem['status'])
    : 'simulated'
}

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
    .in('status', AUDIT_STATUSES as unknown as string[])
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
    orderRef: orderRefOf(row),
    action: AUTO_FIX_ACTIONS.includes(row.action as AutoFixAction)
      ? row.action as AutoFixAction
      : 'none',
    status: auditStatus(row.status),
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

/**
 * Traduit une proposition en une phrase lisible.
 *
 * Un motif generique — "adresse a raccourcir" — n'apprend rien : l'exploitant
 * doit rouvrir la commande et chercher lui-meme quoi couper. En affichant la
 * valeur proposee, il valide ou corrige sans quitter le tableau.
 */
function propositionLisible(plan: Json | null): string | null {
  if (!isRecord(plan)) return null
  const patch = plan.patch
  if (!isRecord(patch)) return null

  const libelles: Record<string, string> = {
    address_line_1: 'nom de la rue',
    address_line_2: "complement d'adresse",
    house_number: 'numero de voie',
    city: 'ville',
    postal_code: 'code postal',
  }

  const parties = Object.entries(patch)
    .filter(([, valeur]) => typeof valeur === 'string' && valeur.length > 0)
    .map(([champ, valeur]) => `${libelles[champ] ?? champ} → « ${String(valeur)} »`)

  if (parties.length === 0) return null

  const perte = Array.isArray(plan.lossy_fields) && plan.lossy_fields.length > 0
  return `Proposition : ${parties.join(', ')}${perte ? ' — une information disparaît, à vérifier.' : ''}`
}

/**
 * Pourquoi le moteur a renonce, dit en clair.
 *
 * Mesure du 07/08 : 92 lignes affichaient "Adresse a raccourcir" sans preciser
 * que le moteur ne pouvait PAS s'en charger. C'est vrai mais trompeur — on
 * peut attendre indefiniment une correction qui ne viendra jamais. Un colis
 * deja cree n'est pas modifiable par le moteur, qui n'ecrit que sur les
 * commandes : cette ligne est donc du travail humain, et doit le dire.
 */
function refusLisible(erreur: Json | null): string | null {
  if (!isRecord(erreur)) return null
  const raison = typeof erreur.reason === 'string' ? erreur.reason : null
  if (!raison) return null

  const messages: Record<string, string> = {
    parcel_not_editable: 'Colis déjà créé : le moteur ne peut pas le modifier, à corriger dans Sendcloud.',
    order_not_corrigible: 'Commande déjà traitée par le transporteur, elle ne peut plus être modifiée.',
    order_lookup_not_found: 'Commande introuvable côté Sendcloud, probablement déjà expédiée.',
    order_ref_unknown: 'Numéro de commande inconnu de notre base, rapprochement impossible.',
    service_points_not_activated: 'Points relais non activés sur cette intégration Sendcloud.',
    service_point_still_active: 'Le point relais fonctionne toujours : la cause est ailleurs.',
    no_replacement_service_point: 'Aucun point relais de remplacement du même réseau à proximité.',
  }
  return messages[raison] ?? null
}

function manualReason(plan: Json | null, pattern: AutoFixPattern, erreur: Json | null = null): string {
  // La proposition concrete passe avant tout message generique.
  const proposition = propositionLisible(plan)
  if (proposition) return proposition

  // Puis le motif du renoncement : il dit a qui revient le travail.
  const refus = refusLisible(erreur)
  if (refus) return refus

  if (isRecord(plan) && Array.isArray(plan.warnings)) {
    const warning = plan.warnings.find((item): item is string => typeof item === 'string' && item.length > 0)
    if (warning) return warning
  }
  const reasons: Record<AutoFixPattern, string> = {
    currency_unsupported: "Devise non prise en charge par le transporteur. La conversion automatique n'existe que pour le franc suisse : à convertir en euros à la main.",
    currency_chf: 'Conversion CHF bloquée tant que le taux et les arrondis ne sont pas validés.',
    address_too_long: 'Adresse à raccourcir avant annonce transporteur.',
    hs_code_missing: 'Configuration douanière incomplète.',
    weight_too_low: 'Poids article inférieur au minimum accepté.',
    service_point_missing: 'Aucun point relais compatible sélectionné.',
    sender_eori_missing: 'EORI expéditeur à configurer dans le compte Sendcloud.',
    address_missing: "Adresse absente : le nom de rue est vide et il n'y a rien à récupérer ailleurs. À renseigner.",
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
      reason: manualReason(row.plan_json, pattern, row.last_error_json ?? null),
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
