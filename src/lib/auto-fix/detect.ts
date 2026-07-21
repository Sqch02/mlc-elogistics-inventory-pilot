import type { Json } from '@/types/database'
import { fingerprintJson, sha256 } from './fingerprint'
import type {
  AutoFixDetection,
  AutoFixPattern,
  AutoFixSourceKind,
  CauseEvidence,
} from './types'

interface RawEvidence {
  source: CauseEvidence['source']
  field: string
  message: string
}

const PATTERN_PRIORITY: AutoFixPattern[] = [
  'sender_eori_missing',
  'currency_chf',
  'address_too_long',
  'hs_code_missing',
  'weight_too_low',
  'service_point_missing',
  'unknown',
]

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function flattenEvidence(
  value: unknown,
  source: RawEvidence['source'],
  field = 'non_field_errors',
): RawEvidence[] {
  if (typeof value === 'string' && value.trim()) {
    return [{ source, field, message: value.trim() }]
  }
  if (Array.isArray(value)) {
    return value.flatMap((child) => flattenEvidence(child, source, field))
  }
  if (isObject(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenEvidence(child, source, field === 'non_field_errors' ? key : `${field}.${key}`),
    )
  }
  return []
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function countryCode(raw: Record<string, unknown>): string | null {
  if (typeof raw.country === 'string') return raw.country.toUpperCase()
  if (isObject(raw.country) && typeof raw.country.iso_2 === 'string') return raw.country.iso_2.toUpperCase()
  return null
}

function carrierCode(raw: Record<string, unknown>): string | null {
  if (typeof raw.carrier === 'string') return raw.carrier
  if (isObject(raw.carrier) && typeof raw.carrier.code === 'string') return raw.carrier.code
  return null
}

function statusId(raw: Record<string, unknown>): number | null {
  if (!isObject(raw.status)) return null
  const value = Number(raw.status.id)
  return Number.isFinite(value) ? value : null
}

function itemObjects(raw: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(raw.parcel_items)
    ? raw.parcel_items.filter(isObject)
    : []
}

function numericWeight(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function extractMaxLength(text: string): number | null {
  const normalized = normalizeText(text)
  const match = normalized.match(/(?:max(?:imum)?|at most|au plus|depasse|limite(?:e)? a?)\D{0,20}(\d{1,3})/)
    ?? normalized.match(/(\d{1,3})\s*(?:caracteres|characters)/)
  return match ? Number.parseInt(match[1], 10) : null
}

function classifyEvidence(evidence: RawEvidence, raw: Record<string, unknown>): AutoFixPattern[] {
  const field = normalizeText(evidence.field)
  const message = normalizeText(evidence.message)
  const combined = `${field} ${message}`
  const matches: AutoFixPattern[] = []

  if (/\beori\b/.test(combined) && /(requis|required|missing|manquant|provide|renseigner|ajouter|\badd\b)/.test(combined)) {
    matches.push('sender_eori_missing')
  }
  if (
    /(devise|currency|contract|contrat)/.test(combined) &&
    (/(chf|eur|non prise en charge|not supported|not valid)/.test(combined)) &&
    (String(raw.total_order_value_currency ?? raw.currency ?? '').toUpperCase() === 'CHF' || countryCode(raw) === 'CH')
  ) {
    matches.push('currency_chf')
  }
  if (
    /(address|adresse|city|ville|house.?number|postal|address_add)/.test(combined) &&
    /(caracter|character|trop long|too long|depasse|exceed|raccourcir|at most|max)/.test(combined)
  ) {
    matches.push('address_too_long')
  }
  if (
    /(hs.?code|harmonized|code douan|origin_country|country of origin|pays d.origine)/.test(combined) &&
    /(requis|required|missing|manquant|vide|blank)/.test(combined)
  ) {
    matches.push('hs_code_missing')
  }
  if (
    /(weight|poids)/.test(combined) &&
    /(minimum|greater than|superieur|trop faible|too low|0[.,]0*0?1|0[.,]00099)/.test(combined)
  ) {
    matches.push('weight_too_low')
  }
  if (
    /(service.?point|point relais|pickup.?point|to_service_point)/.test(combined) &&
    /(selection|select|requis|required|missing|manquant|introuvable|not found|invalid|not valid|blank|null|empty)/.test(combined)
  ) {
    matches.push('service_point_missing')
  }
  return matches
}

function addressLengths(raw: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const key of ['address', 'address_1', 'address_2', 'house_number', 'city', 'postal_code']) {
    if (typeof raw[key] === 'string') result[key] = raw[key].length
  }
  return result
}

export function detectAutoFixCause(
  rawValue: unknown,
  sourceKind: AutoFixSourceKind,
): AutoFixDetection | null {
  if (!isObject(rawValue)) return null
  const raw = rawValue
  const blockingEvidence = [
    ...flattenEvidence(raw.errors, 'errors'),
    ...flattenEvidence(raw.checkout_payload_errors, 'checkout_payload_errors'),
  ]

  // On Hold, 1002 and warnings are context only. Without a structured blocking
  // cause there is deliberately no job and therefore no speculative fix.
  if (blockingEvidence.length === 0) return null

  const detected = new Set<AutoFixPattern>()
  for (const evidence of blockingEvidence) {
    for (const pattern of classifyEvidence(evidence, raw)) detected.add(pattern)
  }
  if (detected.size === 0) detected.add('unknown')
  const detectedPatterns = PATTERN_PRIORITY.filter((pattern) => detected.has(pattern))
  const items = itemObjects(raw)
  const missingCustomsIndexes = items.flatMap((item, index) =>
    !item.hs_code || !item.origin_country ? [index] : [],
  )
  const lowWeightIndexes = items.flatMap((item, index) => {
    const weight = numericWeight(item.weight)
    return weight !== null && weight < 0.001 ? [index] : []
  })
  const maxLengths = blockingEvidence
    .map((item) => ({ field: item.field, max: extractMaxLength(item.message) }))
    .filter((item): item is { field: string; max: number } => item.max !== null)

  const canonicalEvidence = blockingEvidence.map((item) => ({
    source: item.source,
    field: normalizeText(item.field),
    message: normalizeText(item.message),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  const summary: Record<string, Json | undefined> = {
    status_id: statusId(raw),
    status_context: statusId(raw) === 1002 ? 'announcement_failed_1002' : null,
    date_announced_present: Boolean(raw.date_announced),
    country_code: countryCode(raw),
    currency: typeof raw.total_order_value_currency === 'string'
      ? raw.total_order_value_currency.toUpperCase()
      : typeof raw.currency === 'string' ? raw.currency.toUpperCase() : null,
    carrier_code: carrierCode(raw),
    error_fields: [...new Set(blockingEvidence.map((item) => item.field))].sort(),
    address_lengths: addressLengths(raw),
    address_limits: maxLengths,
    item_count: items.length,
    missing_customs_item_indexes: missingCustomsIndexes,
    low_weight_item_indexes: lowWeightIndexes,
    service_point_present: Boolean(raw.to_service_point),
  }

  const sourceFingerprint = fingerprintJson({
    source_kind: sourceKind,
    evidence: canonicalEvidence,
    summary: summary as never,
    patterns: detectedPatterns,
  })

  return {
    sourceKind,
    primaryPattern: detectedPatterns[0],
    detectedPatterns,
    sourceFingerprint,
    evidence: blockingEvidence.map((item): CauseEvidence => ({
      source: item.source,
      field: item.field.slice(0, 120),
      messageHash: sha256(normalizeText(item.message)),
    })),
    sourceSummary: summary,
  }
}
