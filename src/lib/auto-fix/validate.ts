// Detection des erreurs LATENTES.
//
// Sendcloud ne remplit le champ `errors` d'une commande qu'au moment ou l'on
// TENTE de creer l'etiquette. Tant que personne ne tente, une commande
// invalide est indiscernable d'une commande saine. C'est pourquoi le detecteur
// actuel, qui exige une cause structuree, ne se declenche presque jamais :
// mesure faite sur 600 commandes reelles, une seule portait un bloc d'erreur
// alors que quinze violaient deja une regle connue.
//
// Ce module applique les regles nous-memes, en amont. Il ne devine rien : il
// ne code que des regles dont on a observe le message de refus reel, et il
// produit une preuve dans le MEME format que Sendcloud, pour que toute la
// chaine de classification en aval fonctionne sans modification.
//
// Precaution importante sur les limites : la limite de 32 caracteres sur la
// voie a ete observee sur une livraison en point relais (Mondial Relay limite
// effectivement a 32). Rien ne prouve qu'elle vaille pour tous les
// transporteurs. Les limites sont donc parametrables, et leur origine est
// tracee dans la preuve produite — on n'affirme pas ce qu'on n'a pas verifie.

export interface ValidationRules {
  /** Limite sur la voie COMBINEE au numero de maison. */
  addressCombinedMax: number | null
  /** Limite sur la ville. */
  cityMax: number | null
  /** Sendcloud refuse une expedition sans aucune ligne d'article. */
  requireParcelItems: boolean
}

/**
 * Regles observees en production. `confirmed` liste celles dont on a lu le
 * message de refus reel ; les autres sont des hypotheses et doivent le rester.
 */
export const OBSERVED_RULES: ValidationRules = {
  addressCombinedMax: 32,
  cityMax: 30,
  requireParcelItems: true,
}

export interface LatentEvidence {
  field: string
  message: string
  /** Toujours 'latent' : cette erreur ne s'est PAS encore produite. */
  source: 'latent'
  /** Sur quoi repose la regle, pour que l'operateur puisse en juger. */
  basis: 'observed_refusal' | 'assumed'
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Une commande annulee ou deja retournee ne sera jamais expediee : la signaler
 * creerait du travail sur ce que personne n'imprimera.
 */
export function isWorthValidating(raw: Record<string, unknown>): boolean {
  if (raw.is_return === true) return false
  const status = isObject(raw.order_status) ? text(raw.order_status.id) : text(raw.order_status)
  return !/cancel|annul/i.test(status)
}

/**
 * Applique les regles connues et renvoie des preuves au format Sendcloud.
 * Les messages imitent volontairement la formulation reelle : la
 * classification en aval s'appuie dessus, et l'operateur reconnait le refus
 * qu'il aurait obtenu.
 */
export function findLatentErrors(
  rawValue: unknown,
  rules: ValidationRules = OBSERVED_RULES,
): LatentEvidence[] {
  if (!isObject(rawValue)) return []
  const raw = rawValue
  if (!isWorthValidating(raw)) return []

  const found: LatentEvidence[] = []

  const address = text(raw.address)
  const houseNumber = text(raw.house_number)
  if (rules.addressCombinedMax !== null && address) {
    const combined = houseNumber ? `${address} ${houseNumber}`.trim() : address
    if (combined.length > rules.addressCombinedMax) {
      found.push({
        field: 'address_1',
        source: 'latent',
        basis: 'observed_refusal',
        message:
          `Ensure that address 1 combined with the house number has at most ` +
          `${rules.addressCombinedMax} characters (it has ${combined.length}).`,
      })
    }
  }

  const city = text(raw.city)
  if (rules.cityMax !== null && city.length > rules.cityMax) {
    found.push({
      field: 'city',
      source: 'latent',
      basis: 'observed_refusal',
      message: `Ensure this field has no more than ${rules.cityMax} characters.`,
    })
  }

  if (rules.requireParcelItems) {
    const items = Array.isArray(raw.parcel_items) ? raw.parcel_items : []
    if (items.length === 0) {
      found.push({
        field: 'parcel_items',
        source: 'latent',
        basis: 'observed_refusal',
        message: 'At least one parcel item is required.',
      })
    }
  }

  return found
}
