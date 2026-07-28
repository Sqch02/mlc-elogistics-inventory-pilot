import type { ParsedShipment } from '@/lib/sendcloud/types'
import type { Json } from '@/types/database'
import type { ChfRateResolution } from './exchange-rate'

export const AUTO_FIX_PATTERNS = [
  'currency_chf',
  'address_too_long',
  'hs_code_missing',
  'weight_too_low',
  'service_point_missing',
  'sender_eori_missing',
  'unknown',
] as const

export type AutoFixPattern = (typeof AUTO_FIX_PATTERNS)[number]
export type AutoFixSourceKind = 'parcel' | 'integration_shipment'

export const AUTO_FIX_JOB_STATES = [
  'queued',
  'claimed',
  'planned',
  'applied',
  'retry_wait',
  'simulated',
  'pending_manual',
  'verified',
  'manual_resolved',
  'permanent_failed',
] as const

export const AUTO_FIX_ACTIONS = [
  'none',
  'put_update',
  'create_linked',
  'manual_required',
  'account_configuration',
] as const

export type AutoFixJobState = (typeof AUTO_FIX_JOB_STATES)[number]
export type AutoFixAction = (typeof AUTO_FIX_ACTIONS)[number]

export interface CauseEvidence {
  /**
   * `latent` designe une regle que NOUS avons appliquee en amont : le refus ne
   * s'est pas encore produit. Sendcloud ne remplit `errors` qu'a la tentative
   * de creation d'etiquette.
   */
  source: 'errors' | 'checkout_payload_errors' | 'latent'
  field: string
  messageHash: string
}

export interface AutoFixDetection {
  sourceKind: AutoFixSourceKind
  primaryPattern: AutoFixPattern
  detectedPatterns: AutoFixPattern[]
  sourceFingerprint: string
  evidence: CauseEvidence[]
  sourceSummary: Record<string, Json | undefined>
}

export interface TenantFixDefaults {
  defaultHsCode: string | null
  defaultOriginCountry: string | null
}

export interface AutoFixCandidateJob {
  tenant_id: string
  shipment_id: string
  source_kind: AutoFixSourceKind
  source_sendcloud_id: string
  source_order_ref_hash: string | null
  source_fingerprint: string
  primary_pattern: AutoFixPattern
  detected_patterns: AutoFixPattern[]
  mode: AutoFixMode
  operation_key: string
  priority: number
  evidence_json: Json
  source_summary_json: Json
  original_sendcloud_id: string
  source_observed_at: string
}

export interface SimulationPlan {
  version: 2
  action: 'none' | 'put_update' | 'create_linked' | 'manual_required' | 'account_configuration'
  wouldEndState: 'verified' | 'pending_manual'
  patterns: AutoFixPattern[]
  changes: Json[]
  safeguards: string[]
  warnings: string[]
}

export interface AutoFixPlanningContext {
  chfToEurRate?: ChfRateResolution
}

/**
 * Le mode d'une tache doit suivre celui du client. Le figer a 'simulated'
 * rendait tout armement inoperant : la reclamation exige que le mode de la
 * tache ET celui du client coincident, donc un client passe en 'live'
 * n'aurait trouve aucune tache a traiter.
 */
export type AutoFixMode = 'simulated' | 'live'

export interface CandidateSource {
  shipmentId: string
  shipment: ParsedShipment
}

export interface ClaimedAutoFixJob {
  id: string
  tenant_id: string
  shipment_id: string | null
  source_kind: AutoFixSourceKind
  source_sendcloud_id: string
  source_fingerprint: string
  primary_pattern: AutoFixPattern
  detected_patterns: AutoFixPattern[]
  operation_key: string
  mode: AutoFixMode
  evidence_json: Json
  source_summary_json: Json
}
