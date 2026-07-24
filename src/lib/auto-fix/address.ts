// Raccourcissement concret des champs d'adresse trop longs.
//
// Le detecteur repere la cause ("Ensure that city has at most 26 characters")
// et le planner nommait jusqu'ici une strategie sans jamais calculer la valeur
// corrigee. Pour ecrire reellement chez Sendcloud il faut la valeur, pas
// l'intention.
//
// Principe de sûrete, et c'est le coeur de ce module : abreger n'est pas
// tronquer. "Saint-Remy" -> "St-Remy" conserve l'information, un facteur et un
// transporteur lisent la meme adresse. Couper "Chambretaud Les Grands Champs"
// a 20 caracteres, en revanche, PERD de l'information et peut changer la
// destination. Le premier cas peut s'appliquer tout seul ; le second exige une
// revue humaine. La distinction est portee par le drapeau `lossy`.

const ADDRESS_FIELDS = [
  'address',
  'address_1',
  'address_2',
  'house_number',
  'city',
  'postal_code',
] as const

export type AddressField = (typeof ADDRESS_FIELDS)[number]

// Abreviations postales usuelles, sans perte de sens. L'ordre compte : on
// traite les formes les plus longues d'abord pour eviter qu'une abreviation
// partielle n'empeche la suivante.
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bSainte\b/gi, 'Ste'],
  [/\bSaint\b/gi, 'St'],
  [/\bBoulevard\b/gi, 'Bd'],
  [/\bAvenue\b/gi, 'Av'],
  [/\bResidence\b/gi, 'Res'],
  [/\bRésidence\b/gi, 'Rés'],
  [/\bAppartement\b/gi, 'Apt'],
  [/\bBatiment\b/gi, 'Bat'],
  [/\bBâtiment\b/gi, 'Bât'],
  [/\bImmeuble\b/gi, 'Imm'],
  [/\bLotissement\b/gi, 'Lot'],
  [/\bChemin\b/gi, 'Ch'],
  [/\bImpasse\b/gi, 'Imp'],
  [/\bPlace\b/gi, 'Pl'],
  [/\bSquare\b/gi, 'Sq'],
  [/\bFaubourg\b/gi, 'Fbg'],
  [/\bZone Industrielle\b/gi, 'ZI'],
]

export interface ShortenResult {
  value: string
  /** true si de l'information a ete perdue (coupe), false si simple abreviation. */
  lossy: boolean
  /** Transformations appliquees, dans l'ordre. */
  applied: string[]
}

export function shortenAddressField(value: string, limit: number): ShortenResult {
  const applied: string[] = []

  // Une limite absurde ne doit pas nous faire inventer une valeur.
  if (!Number.isFinite(limit) || limit < 1) return { value, lossy: false, applied }
  if (value.length <= limit) return { value, lossy: false, applied }

  let current = value

  // 1. Espaces redondants : gain gratuit, aucune perte.
  const collapsed = current.replace(/\s+/g, ' ').trim()
  if (collapsed !== current) {
    current = collapsed
    applied.push('collapse_whitespace')
    if (current.length <= limit) return { value: current, lossy: false, applied }
  }

  // 2. Abreviations postales : conserve le sens.
  let abbreviated = current
  for (const [pattern, replacement] of ABBREVIATIONS) {
    abbreviated = abbreviated.replace(pattern, replacement)
  }
  abbreviated = abbreviated.replace(/\s+/g, ' ').trim()
  if (abbreviated !== current) {
    current = abbreviated
    applied.push('abbreviate')
    if (current.length <= limit) return { value: current, lossy: false, applied }
  }

  // 3. Coupe a la frontiere de mot : a partir d'ici, on PERD de l'information.
  const cut = current.slice(0, limit)
  const lastBoundary = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('-'))
  if (lastBoundary > 0) {
    applied.push('word_boundary')
    return { value: cut.slice(0, lastBoundary).trim(), lossy: true, applied }
  }

  // 4. Dernier recours : un seul mot plus long que la limite.
  applied.push('truncate')
  return { value: cut, lossy: true, applied }
}

export interface AddressLimit {
  field: string
  max: number
}

export interface AddressAuditEntry {
  field: AddressField
  before_length: number
  after_length: number
  limit: number
  applied: string[]
  lossy: boolean
}

export interface AddressShorteningPlan {
  /** true seulement si TOUT le patch est applicable sans perte d'information. */
  ready: boolean
  patch: Partial<Record<AddressField, string>>
  lossyFields: AddressField[]
  audit: AddressAuditEntry[]
  reason: 'ok' | 'nothing_to_shorten' | 'lossy_shortening_requires_review'
}

function isAddressField(field: string): field is AddressField {
  return (ADDRESS_FIELDS as readonly string[]).includes(field)
}

export function planAddressShortening(
  raw: Record<string, unknown>,
  limits: AddressLimit[],
): AddressShorteningPlan {
  // Un meme champ peut etre signale plusieurs fois : on retient la contrainte
  // la plus stricte, sinon on produirait une valeur encore refusee.
  const strictest = new Map<AddressField, number>()
  for (const limit of limits) {
    if (!isAddressField(limit.field)) continue
    if (!Number.isFinite(limit.max) || limit.max < 1) continue
    const previous = strictest.get(limit.field)
    strictest.set(limit.field, previous === undefined ? limit.max : Math.min(previous, limit.max))
  }

  const patch: Partial<Record<AddressField, string>> = {}
  const lossyFields: AddressField[] = []
  const audit: AddressAuditEntry[] = []

  for (const [field, max] of strictest) {
    const value = raw[field]
    if (typeof value !== 'string' || value.length <= max) continue

    const result = shortenAddressField(value, max)
    if (result.value === value) continue

    patch[field] = result.value
    if (result.lossy) lossyFields.push(field)
    audit.push({
      field,
      before_length: value.length,
      after_length: result.value.length,
      limit: max,
      applied: result.applied,
      lossy: result.lossy,
    })
  }

  if (audit.length === 0) {
    return { ready: false, patch: {}, lossyFields: [], audit: [], reason: 'nothing_to_shorten' }
  }

  // Le patch est calcule meme quand il est refuse : l'operateur doit pouvoir
  // voir ce qui serait applique avant de trancher.
  if (lossyFields.length > 0) {
    return { ready: false, patch, lossyFields, audit, reason: 'lossy_shortening_requires_review' }
  }

  return { ready: true, patch, lossyFields, audit, reason: 'ok' }
}
