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
  [/\bMar[ée]chal\b/gi, 'Mal'],
  [/\bG[ée]n[ée]ral\b/gi, 'Gal'],
  [/\bDocteur\b/gi, 'Dr'],
  [/\bRoute\b/gi, 'Rte'],
  [/\bAll[ée]e\b/gi, 'All'],
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

  // 2. Abreviations postales : conserve le sens. On les applique UNE A UNE et
  //    on s'arrete des que la limite est tenue. Abreger au-dela du necessaire
  //    serait sans perte mais eloignerait inutilement l'adresse de ce que le
  //    destinataire a saisi — et c'est lui qui la relira sur le colis.
  let abbreviatedAny = false
  for (const [pattern, replacement] of ABBREVIATIONS) {
    const next = current.replace(pattern, replacement).replace(/\s+/g, ' ').trim()
    if (next === current) continue
    current = next
    abbreviatedAny = true
    if (current.length <= limit) {
      applied.push('abbreviate')
      return { value: current, lossy: false, applied }
    }
  }
  if (abbreviatedAny) applied.push('abbreviate')

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

// ---------------------------------------------------------------------------
// Strategies contextuelles, sans perte
//
// Confrontation aux vraies commandes refusees par Sendcloud : sur 15 adresses
// trop longues, l'abreviation seule n'en reglait que 6. Les autres echouaient
// sur des motifs recurrents qui ne demandent pourtant AUCUNE perte
// d'information, parce que l'information existe deja ailleurs dans la commande :
//
//   "76 grand rue hoscas Herbignac 44410"    ville + code postal recopies
//   "106 B Rue de la Richelandiere 42100 St Etienne"          idem
//   "515 route la fontaine des oiseaux 515"  numero de voie recopie a la fin
//   "27 Rue du Soleil Levant (Landemont)"    lieu-dit, address_2 vide
//   "6 rue de la borderie - l'Aubertiere"    idem
//
// Retirer un code postal deja porte par `postal_code`, ou deplacer un lieu-dit
// vers un `address_2` vide, ne change pas la destination : les deux champs sont
// imprimes sur l'etiquette. C'est pourquoi ces strategies restent `lossy: false`
// alors que la coupe, elle, ne peut pas l'etre.
// ---------------------------------------------------------------------------

/** Compare des toponymes malgre accents, casse, tirets et Saint/St. */
function normalizeLocality(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bsainte\b/g, 'ste')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[^a-z0-9]/g, '')
}

function tokenize(value: string): string[] {
  return value.split(/\s+/).filter(Boolean)
}

/**
 * Retire du libelle de voie ce que la commande porte deja dans ses champs
 * structures : code postal, ville en fin de chaine, et numero de voie recopie.
 * Strictement sans perte — on ne supprime qu'un doublon exact.
 */
export function stripRedundantLocality(
  value: string,
  context: { city?: string; postalCode?: string },
): { value: string; applied: string[] } {
  const applied: string[] = []
  let tokens = tokenize(value)

  // 1. Code postal recopie. Exige au moins 4 caracteres pour ne jamais
  //    confondre avec un numero de voie.
  const postal = (context.postalCode ?? '').trim()
  if (postal.length >= 4) {
    const target = normalizeLocality(postal)
    const kept = tokens.filter((token) => normalizeLocality(token) !== target)
    if (kept.length !== tokens.length && kept.length >= 2) {
      tokens = kept
      applied.push('drop_redundant_postal_code')
    }
  }

  // 2. Ville recopiee en FIN de libelle uniquement. Au milieu, le nom peut
  //    faire partie de la voie ("rue de Saint Cybard" a Mouleydier) : on ne
  //    touche pas.
  const city = (context.city ?? '').trim()
  if (city.length >= 3) {
    const target = normalizeLocality(city)
    for (let take = Math.min(5, tokens.length - 2); take >= 1; take--) {
      const tail = tokens.slice(tokens.length - take)
      if (normalizeLocality(tail.join(' ')) === target) {
        tokens = tokens.slice(0, tokens.length - take)
        applied.push('drop_redundant_city')
        break
      }
    }
  }

  // 3. Numero de voie recopie en fin ("515 route ... 515").
  if (tokens.length >= 3 && /^\d+$/.test(tokens[0]) && tokens[tokens.length - 1] === tokens[0]) {
    tokens = tokens.slice(0, -1)
    applied.push('drop_duplicated_house_number')
  }

  const rebuilt = tokens.join(' ').replace(/[\s,;-]+$/, '').trim()
  return { value: rebuilt || value, applied }
}

// Mots qui introduisent un complement d'adresse et non la voie elle-meme.
const COMPLEMENT_KEYWORDS =
  '(?:imm|immeuble|bat|bati?ment|b[aâ]t(?:iment)?|res|r[ée]sidence|appt?|appartement|esc|escalier|etg|[ée]tage|lieu-?dit|ld|entr[ée]e)'

/**
 * Isole un complement d'adresse reellement separable : parenthese finale,
 * segment apres tiret, ou mention de batiment en tete suivie de la voie.
 * Renvoie null quand rien n'est franchement separable — auquel cas mieux vaut
 * une revue humaine qu'une decoupe arbitraire au milieu d'un nom de voie.
 */
export function extractComplement(value: string): { address: string; complement: string } | null {
  const trimmed = value.trim()

  const parenthesis = trimmed.match(/^(.*\S)\s*\(([^()]{2,})\)\s*$/)
  if (parenthesis) return { address: parenthesis[1].trim(), complement: parenthesis[2].trim() }

  const dash = trimmed.match(/^(.*\S)\s+[-–]\s+(\S.{1,})$/)
  if (dash && tokenize(dash[1]).length >= 2) return { address: dash[1].trim(), complement: dash[2].trim() }

  // "IMM limbourg 69 rue Albert lamotte" -> complement en tete, voie ensuite.
  const leading = new RegExp(`^(${COMPLEMENT_KEYWORDS}\\b[^0-9]{0,25}?)\\s+(\\d.*)$`, 'i')
  const head = trimmed.match(leading)
  if (head && tokenize(head[2]).length >= 2) return { address: head[2].trim(), complement: head[1].trim() }

  return null
}

export interface AddressContextResult extends ShortenResult {
  /** Renseigne quand un complement a ete deplace vers un `address_2` vide. */
  address2?: string
}

/**
 * Enchaine les strategies de la moins destructrice a la plus destructrice :
 * doublons deja portes par d'autres champs, puis deplacement d'un complement
 * vers un `address_2` vide, puis abreviation, et seulement en dernier la coupe.
 * On ne deplace JAMAIS vers un `address_2` deja rempli : ecraser une precision
 * saisie par le destinataire serait une perte, pas un raccourcissement.
 */
export function shortenAddressWithContext(
  value: string,
  limit: number,
  context: { city?: string; postalCode?: string; address2?: string },
): AddressContextResult {
  if (!Number.isFinite(limit) || limit < 1) return { value, lossy: false, applied: [] }
  if (value.length <= limit) return { value, lossy: false, applied: [] }

  const applied: string[] = []
  let current = value

  const stripped = stripRedundantLocality(current, context)
  if (stripped.value !== current) {
    current = stripped.value
    applied.push(...stripped.applied)
    if (current.length <= limit) return { value: current, lossy: false, applied }
  }

  const address2Free = !context.address2 || context.address2.trim() === ''
  if (address2Free) {
    const split = extractComplement(current)
    // Le complement doit lui-meme tenir dans la limite, sinon on ne fait que
    // deplacer le refus d'un champ a l'autre.
    if (split && split.address.length <= limit && split.complement.length <= limit) {
      applied.push('move_complement_to_address_2')
      return { value: split.address, lossy: false, applied, address2: split.complement }
    }
  }

  const fallback = shortenAddressField(current, limit)
  return { value: fallback.value, lossy: fallback.lossy, applied: [...applied, ...fallback.applied] }
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

// Sendcloud nomme le champ `address_1` dans ses messages d'erreur, alors que la
// commande et la mise a jour du colis l'appellent `address`. Sans cette
// equivalence, la limite signalee ne trouvait aucune valeur a raccourcir et le
// plan sortait vide.
function canonicalField(field: string): AddressField | null {
  const normalized = field.trim().toLowerCase()
  if (normalized === 'address_1' || normalized === 'address1' || normalized === 'street') return 'address'
  return isAddressField(normalized) ? normalized : null
}

export function planAddressShortening(
  raw: Record<string, unknown>,
  limits: AddressLimit[],
): AddressShorteningPlan {
  // Un meme champ peut etre signale plusieurs fois : on retient la contrainte
  // la plus stricte, sinon on produirait une valeur encore refusee.
  const strictest = new Map<AddressField, number>()
  for (const limit of limits) {
    const field = canonicalField(limit.field)
    if (!field) continue
    if (!Number.isFinite(limit.max) || limit.max < 1) continue
    const previous = strictest.get(field)
    strictest.set(field, previous === undefined ? limit.max : Math.min(previous, limit.max))
  }

  const patch: Partial<Record<AddressField, string>> = {}
  const lossyFields: AddressField[] = []
  const audit: AddressAuditEntry[] = []

  const asText = (key: string): string | undefined =>
    typeof raw[key] === 'string' ? (raw[key] as string) : undefined

  for (const [field, max] of strictest) {
    const value = raw[field]
    if (typeof value !== 'string') continue

    // Sendcloud mesure la voie « combinee au numero » : la limite porte sur les
    // deux. On reserve donc la place du numero plutot que de produire une
    // valeur qui serait refusee une seconde fois.
    const houseNumber = field === 'address' ? (asText('house_number') ?? '') : ''
    const budget = houseNumber ? max - (houseNumber.length + 1) : max
    if (budget < 1 || value.length <= budget) continue

    const result =
      field === 'address'
        ? shortenAddressWithContext(value, budget, {
            city: asText('city'),
            postalCode: asText('postal_code'),
            address2: asText('address_2'),
          })
        : shortenAddressField(value, budget)
    if (result.value === value) continue

    patch[field] = result.value
    if (result.lossy) lossyFields.push(field)
    audit.push({
      field,
      before_length: value.length,
      after_length: result.value.length,
      limit: budget,
      applied: result.applied,
      lossy: result.lossy,
    })

    // Seule la branche `address` peut produire un deplacement de complement.
    const moved = field === 'address' ? (result as AddressContextResult).address2 : undefined
    if (moved && patch.address_2 === undefined) patch.address_2 = moved
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
