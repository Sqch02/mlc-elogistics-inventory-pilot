import type { Json } from '@/types/database'
import type {
  AutoFixDetection,
  ClaimedAutoFixJob,
  SimulationPlan,
  TenantFixDefaults,
} from './types'

function asRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {}
}

function buildPlan(
  detection: Pick<AutoFixDetection, 'sourceKind' | 'detectedPatterns' | 'sourceSummary'>,
  defaults: TenantFixDefaults,
): SimulationPlan {
  const summary = detection.sourceSummary
  const changes: Json[] = []
  const warnings: string[] = []
  let action: SimulationPlan['action'] = detection.sourceKind === 'parcel' ? 'put_update' : 'create_linked'
  let wouldEndState: SimulationPlan['wouldEndState'] = 'verified'

  for (const pattern of detection.detectedPatterns) {
    if (pattern === 'currency_chf') {
      changes.push({ pattern, currency_from: summary.currency ?? 'CHF', currency_to: 'EUR', requires_fixed_rate: true, values_redacted: true })
      wouldEndState = 'pending_manual'
      warnings.push('Conversion interdite sans taux date, arrondis et controle total/items')
    } else if (pattern === 'address_too_long') {
      changes.push({ pattern, strategy: 'abbreviate_then_word_boundary', lengths: summary.address_lengths ?? {}, limits: summary.address_limits ?? [] })
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
    version: 1,
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
): SimulationPlan {
  return buildPlan(detection, defaults)
}

export function buildSimulationPlanFromJob(job: ClaimedAutoFixJob): SimulationPlan {
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
  })
}
