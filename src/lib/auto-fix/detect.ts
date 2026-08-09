import type { Json } from '@/types/database'
import { fingerprintJson, sha256 } from './fingerprint'
import { findLatentErrors, type ValidationRules } from './validate'
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

function monetaryValue(value: unknown): string | null {
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : ''
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const [whole, fraction = ''] = raw.split('.')
  return `${whole.replace(/^0+(?=\d)/, '') || '0'}.${fraction.padEnd(2, '0')}`
}

function itemQuantity(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null
}

function monetarySummary(
  raw: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
): Json {
  return {
    total_order_value: monetaryValue(raw.total_order_value),
    parcel_items: items.map((item, index) => ({
      index,
      quantity: itemQuantity(item.quantity),
      value: monetaryValue(item.value),
    })),
  }
}

function extractMaxLength(text: string): number | null {
  const normalized = normalizeText(text)
  const match = normalized.match(/(?:max(?:imum)?|at most|au plus|depasse|limite(?:e)? a?)\D{0,20}(\d{1,3})/)
    ?? normalized.match(/(\d{1,3})\s*(?:caracteres|characters)/)
  return match ? Number.parseInt(match[1], 10) : null
}

/**
 * Panne passagere du transporteur, et non un defaut de la commande.
 *
 * Mesure du 07/08 : premier motif de la file manuelle, 47 occurrences, et il
 * en arrivait encore. Rien n'y est corrigeable — le message dit lui-meme de
 * reessayer plus tard. Ces lignes occupaient l'exploitation avec du travail
 * qui ne lui appartient pas.
 *
 * Le libelle varie beaucoup ("Erreur du transporteur : service indisponible",
 * "Le transporteur a renvoye une erreur, service indisponible. Veuillez
 * verifier le site Web du transporteur", au moins sept formulations pour la
 * meme panne), d'ou un test sur le fond du message et non sur sa forme.
 */
function isTransientCarrierError(message: string): boolean {
  const texte = normalizeText(message)
  const parleDuTransporteur = /(transporteur|carrier)/.test(texte)
  const diServiceIndisponible = /(service indisponible|service unavailable|temporarily unavailable|indisponible temporairement)/.test(texte)
  const inviteAReessayer = /(reessayer|ressayer|try again|later|plus tard)/.test(texte)
  return diServiceIndisponible && (parleDuTransporteur || inviteAReessayer)
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
  // Numero de voie EXIGE mais vide. Range avec les corrections d'adresse parce
  // que c'est le meme plan qui le traite : il sait recuperer le numero depuis
  // le libelle de rue ("rue dieffiere n°13") ou le complement.
  //
  // Sans cette ligne, la tache restait en "cause inconnue" et n'etait donc
  // jamais planifiee — la reparation existait mais ne tournait jamais. Releve
  // le 09/08 sur des commandes belges.
  if (
    /house.?number/.test(field) &&
    /(obligatoire|required|requis|manquant|missing|blank|empty|vide|ce champ)/.test(combined)
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
    // "no longer operational" manquait : le motif s'appelle _missing, mais le
    // cas reel n'est pas un relais absent, c'est un relais FERME. Mesure du
    // 07/08 : 17 occurrences classees "cause inconnue" faute de ce vocabulaire,
    // alors que le remplacement de relais est justement ce que le moteur sait
    // faire. Un motif qui ne reconnait pas son propre cas d'usage ne sert a rien.
    /(selection|select|requis|required|missing|manquant|introuvable|not found|invalid|not valid|blank|null|empty|no longer operational|not operational|plus operationnel|closed|ferme|inactive|inactif)/.test(combined)
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

export interface DetectOptions {
  /**
   * Applique aussi les regles de validation connues pour reperer ce qui VA
   * echouer. Desactive par defaut : sans cela, le comportement est inchange.
   *
   * Sendcloud ne remplit `errors` qu'au moment ou l'on tente de creer
   * l'etiquette. Mesure sur 600 commandes reelles : une seule portait un bloc
   * d'erreur alors que quinze violaient deja une regle connue. Sans detection
   * latente, la file reste donc quasiment vide et le moteur ne sert a rien.
   */
  latentRules?: ValidationRules | null
}

export function detectAutoFixCause(
  rawValue: unknown,
  sourceKind: AutoFixSourceKind,
  options: DetectOptions = {},
): AutoFixDetection | null {
  if (!isObject(rawValue)) return null
  const raw = rawValue
  const reportedEvidence = [
    ...flattenEvidence(raw.errors, 'errors'),
    ...flattenEvidence(raw.checkout_payload_errors, 'checkout_payload_errors'),
  ]
    // Une panne passagere du transporteur n'est pas un defaut de la commande.
    // On l'ecarte comme simple contexte : si la commande porte AUSSI un vrai
    // defaut, celui-ci subsiste et la tache est creee normalement.
    .filter((item) => !isTransientCarrierError(item.message))
  const latentEvidence: RawEvidence[] = options.latentRules
    ? findLatentErrors(raw, options.latentRules).map((item) => ({
        source: 'latent' as const,
        field: item.field,
        message: item.message,
      }))
    : []
  const blockingEvidence = [...reportedEvidence, ...latentEvidence]

  // On Hold, 1002 and warnings are context only. Without a structured blocking
  // cause there is deliberately no job and therefore no speculative fix.
  if (blockingEvidence.length === 0) return null

  // Un colis deja annonce au transporteur ne se corrige plus : l'etiquette est
  // partie. Mesure sur une journee : treize taches creees puis refusees pour
  // ce seul motif. Ce n'est pas qu'un gaspillage — c'est du bruit dans le
  // tableau que l'exploitation doit lire, et un tableau bruyant finit ignore.
  //
  // Le statut 1002 (echec d'annonce) fait exception : l'annonce a ete tentee
  // mais elle a echoue, donc le colis reste modifiable.
  if (sourceKind === 'parcel' && raw.date_announced) {
    const statut = statusId(raw)
    if (statut !== 1000 && statut !== 1002) return null
  }

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

  // L'empreinte identifie UN PROBLEME SUR UN COLIS, pas qui l'a remarque. Une
  // detection latente et sa confirmation ulterieure par Sendcloud portent le
  // meme message : sans cette normalisation elles produiraient deux empreintes,
  // donc deux taches, donc deux corrections pour un seul defaut.
  const canonicalEvidence = blockingEvidence.map((item) => ({
    source: item.source === 'latent' ? 'errors' : item.source,
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
  // Amounts are retained only for a real structured CHF cause. No SKU,
  // description or customer data enters the queue; retention remains 30 days.
  if (detected.has('currency_chf')) summary.monetary = monetarySummary(raw, items)

  const sourceFingerprint = fingerprintJson({
    source_kind: sourceKind,
    evidence: canonicalEvidence,
    summary: summary as never,
    patterns: detectedPatterns,
  })

  // Renseigne APRES l'empreinte, et c'est deliberé : ce drapeau dit comment on
  // a appris le defaut, pas quel il est. Le faire entrer dans l'empreinte
  // donnerait deux identites au meme probleme sur le meme colis, donc deux
  // taches et deux corrections.
  summary.latent_only = reportedEvidence.length === 0 && latentEvidence.length > 0

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
