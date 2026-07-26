import type { Json } from '@/types/database'
import { buildChfToEurConversion } from './currency'
import type {
  AutoFixDetection,
  AutoFixPlanningContext,
  ClaimedAutoFixJob,
  SimulationPlan,
  TenantFixDefaults,
} from './types'

function asRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {}
}

// Combien de caracteres doivent disparaitre, champ par champ. Se deduit des
// seules longueurs, donc sans jamais lire l'adresse. Sert au tableau de bord
// et rend le refus intelligible quand le depassement est trop important.
function addressOverflow(summary: Record<string, Json | undefined>): Json {
  const lengths = summary.address_lengths
  const limits = summary.address_limits
  if (!lengths || typeof lengths !== 'object' || Array.isArray(lengths)) return []
  if (!Array.isArray(limits)) return []

  const strictest = new Map<string, number>()
  for (const entry of limits) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const field = (entry as Record<string, Json>).field
    const max = (entry as Record<string, Json>).max
    if (typeof field !== 'string' || typeof max !== 'number' || !Number.isFinite(max)) continue
    // Sendcloud nomme `address_1` ce que la commande appelle `address`.
    const key = field === 'address_1' ? 'address' : field
    const previous = strictest.get(key)
    strictest.set(key, previous === undefined ? max : Math.min(previous, max))
  }

  const result: Json[] = []
  for (const [field, max] of strictest) {
    const current = (lengths as Record<string, Json>)[field]
    if (typeof current !== 'number') continue
    if (current <= max) continue
    result.push({ field, current, max, excess: current - max })
  }
  return result
}

function buildPlan(
  detection: Pick<AutoFixDetection, 'sourceKind' | 'detectedPatterns' | 'sourceSummary'>,
  defaults: TenantFixDefaults,
  context: AutoFixPlanningContext,
): SimulationPlan {
  const summary = detection.sourceSummary
  const changes: Json[] = []
  const warnings: string[] = []
  let action: SimulationPlan['action'] = detection.sourceKind === 'parcel' ? 'put_update' : 'create_linked'
  let wouldEndState: SimulationPlan['wouldEndState'] = 'verified'

  for (const pattern of detection.detectedPatterns) {
    if (pattern === 'currency_chf') {
      const conversion = buildChfToEurConversion(summary, context.chfToEurRate)
      changes.push(conversion.change)
      if (!conversion.ready) {
        wouldEndState = 'pending_manual'
        if (action !== 'account_configuration') action = 'manual_required'
        warnings.push(conversion.warning)
      }
    } else if (pattern === 'address_too_long') {
      changes.push({
        pattern,
        strategy: 'lossless_first_then_human_review',
        // La valeur corrigee n'est deliberement PAS calculee ici : la file ne
        // retient que des longueurs, jamais l'adresse elle-meme. Elle est
        // resolue au moment de l'ecriture, sur l'instantane frais du colis.
        // Deux benefices : aucune donnee personnelle n'entre en file, et l'on
        // raccourcit l'adresse ACTUELLE, pas celle vue a la detection.
        value_resolved_at: 'write_time_from_fresh_snapshot',
        lengths: summary.address_lengths ?? {},
        limits: summary.address_limits ?? [],
        overflow: addressOverflow(summary),
      })
    } else if (pattern === 'hs_code_missing') {
      const configured = Boolean(defaults.defaultHsCode && defaults.defaultOriginCountry)
      changes.push({
        pattern,
        item_indexes: summary.missing_customs_item_indexes ?? [],
        hs_source: configured ? 'tenant_settings.default_hs_code' : 'missing',
        origin_source: defaults.defaultOriginCountry ? 'tenant_settings.default_origin_country' : 'missing',
      })
      if (!configured) {
        wouldEndState = 'pending_manual'
        warnings.push('Configuration douaniere tenant incomplete')
      }
    } else if (pattern === 'weight_too_low') {
      changes.push({ pattern, item_indexes: summary.low_weight_item_indexes ?? [], minimum_weight_kg: 0.001 })
    } else if (pattern === 'service_point_missing') {
      changes.push({ pattern, carrier: summary.carrier_code ?? null, radii_m: [5000, 10000, 25000], never_substitute_carrier: true })
      wouldEndState = 'pending_manual'
      warnings.push('Application bloquee jusqu au test Service Points et compatibilite methode')
    } else if (pattern === 'sender_eori_missing') {
      action = 'account_configuration'
      wouldEndState = 'pending_manual'
      changes.push({ pattern, scope: 'sender_account', auto_fixable: false })
    } else {
      action = 'manual_required'
      wouldEndState = 'pending_manual'
      changes.push({ pattern: 'unknown', auto_fixable: false })
    }
  }

  return {
    version: 2,
    action,
    wouldEndState,
    patterns: detection.detectedPatterns,
    changes,
    safeguards: [
      'dry_run_only',
      'no_sendcloud_write',
      'no_stock_write',
      'no_attempt_consumed',
      'no_alert',
      'verify_source_fingerprint_before_future_live_apply',
    ],
    warnings,
  }
}

export function buildSimulationPlan(
  detection: AutoFixDetection,
  defaults: TenantFixDefaults,
  context: AutoFixPlanningContext = {},
): SimulationPlan {
  return buildPlan(detection, defaults, context)
}

export function buildSimulationPlanFromJob(
  job: ClaimedAutoFixJob,
  context: AutoFixPlanningContext = {},
): SimulationPlan {
  const summary = asRecord(job.source_summary_json)
  return buildPlan({
    sourceKind: job.source_kind,
    detectedPatterns: job.detected_patterns,
    sourceSummary: summary,
  }, {
    // The actual customs values never enter the queue/audit. Detection only
    // persists whether both tenant defaults existed when the source was seen.
    defaultHsCode: summary.tenant_default_hs_configured === true ? 'configured' : null,
    defaultOriginCountry: summary.tenant_default_origin_configured === true ? 'configured' : null,
  }, context)
}
