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
  /** Limite sur la deuxieme ligne d'adresse. */
  address2Max: number | null
  /** Limite sur le numero de voie. */
  houseNumberMax: number | null
  /** Limite sur le nom d'entreprise. */
  companyNameMax: number | null
  /** Le libelle de voie est obligatoire : vide, l'expedition est refusee. */
  requireAddress: boolean
  /** Sendcloud refuse une expedition sans aucune ligne d'article. */
  requireParcelItems: boolean
  /**
   * Devises que les transporteurs acceptent. Une commande libellee ailleurs
   * sera refusee a la creation d'etiquette.
   */
  acceptedCurrencies: string[] | null
}

/**
 * Regles observees en production. `confirmed` liste celles dont on a lu le
 * message de refus reel ; les autres sont des hypotheses et doivent le rester.
 */
export const OBSERVED_RULES: ValidationRules = {
  addressCombinedMax: 32,
  // Refus REELS, a trois limites differentes selon le transporteur :
  //   "city has at most 25 characters (it has 26)."  Colis Prive
  //   "city has at most 26 characters (it has 30)."  Mondial Relay
  //   "no more than 30 characters."                  Chronopost
  //
  // On retient la plus stricte. Le raccourcissement d'une ville est sans
  // perte dans l'immense majorite des cas (abreviation "Saint" -> "St",
  // retrait d'un code postal recopie), et une valeur plus courte que
  // necessaire n'est jamais refusee — l'inverse l'est.
  //
  // Verifie avant de resserrer : sur 100 commandes en attente, ZERO ville
  // depassait 25 caracteres. Le resserrement ne fabrique donc pas de bruit,
  // il rattrape des refus qu'on subissait sans les voir venir. Deux cas du
  // 10/08 au soir seraient passes automatiquement.
  cityMax: 25,
  // Deux refus REELS observes le 27/07 sur le meme champ, a deux limites
  // differentes :
  //   "Ensure that address 2 has at most 32 characters (it has 39)."
  //   "La deuxieme ligne d'adresse depasse 30 caracteres"
  // Sendcloud refuse a 32, le transporteur a 30. On retient la plus stricte :
  // produire une valeur plus courte que necessaire n'est jamais refuse,
  // l'inverse l'est.
  address2Max: 30,
  // Deux limites REELLES selon le transporteur :
  //   "no more than 20 characters."                       observe le 27/07
  //   "house number has at most 8 characters (it has 13)" Mondial Relay, 10/08
  //
  // J'avais d'abord DEVINE 8, puis lu 20 sur un refus, et j'en avais conclu
  // que 8 etait faux. Les deux sont vrais : la limite depend du transporteur.
  // Corriger une supposition par une observation ne dispense pas de continuer
  // a observer.
  //
  // On retient la plus stricte. Un numero trop long n'est jamais tronque : il
  // est SEPARE, le texte partant dans le complement d'adresse. L'operation est
  // donc sans perte, et la declencher plus souvent ne coute rien.
  //
  // Verifie avant de resserrer : sur 100 commandes en attente, ZERO numero
  // depassait 8 caracteres.
  houseNumberMax: 8,
  // Refus reel : "Ensure this field has no more than 50 characters." sur
  // "Entreprise individuelle L'Atelier du Phenix par Chris".
  companyNameMax: 50,
  requireAddress: true,
  requireParcelItems: true,
  // Refus reel observe : "La devise fournie n'est pas prise en charge par
  // Colissimo ; convertissez le montant en EUR". Le meme refus se produit chez
  // d'autres transporteurs — c'est la devise qui pose probleme, pas le
  // transporteur.
  acceptedCurrencies: ['EUR'],
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

  if (rules.requireAddress && address.trim() === '') {
    // Observe : "Nom de la rue — Ce champ est obligatoire." Rien a raccourcir
    // ici, il n'y a pas d'adresse du tout. La detection sert a le signaler
    // avant la tentative d'etiquette, pas a inventer une valeur.
    found.push({
      field: 'address_1',
      source: 'latent',
      basis: 'observed_refusal',
      message: 'Ce champ est obligatoire.',
    })
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

  const address2 = text(raw.address_2)
  if (rules.address2Max !== null && address2.length > rules.address2Max) {
    found.push({
      field: 'address_2',
      source: 'latent',
      basis: 'observed_refusal',
      message: `Ensure that address 2 has at most ${rules.address2Max} characters (it has ${address2.length}).`,
    })
  }

  if (rules.houseNumberMax !== null && houseNumber.length > rules.houseNumberMax) {
    found.push({
      field: 'house_number',
      source: 'latent',
      basis: 'observed_refusal',
      message: `Ensure that house number has at most ${rules.houseNumberMax} characters (it has ${houseNumber.length}).`,
    })
  }

  const entreprise = text(raw.company_name)
  if (rules.companyNameMax !== null && entreprise.length > rules.companyNameMax) {
    found.push({
      field: 'company_name',
      source: 'latent',
      basis: 'observed_refusal',
      message: `Ensure this field has no more than ${rules.companyNameMax} characters.`,
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

  if (rules.acceptedCurrencies && rules.acceptedCurrencies.length > 0) {
    const devise = text(raw.total_order_value_currency) || text(raw.currency)
    if (devise && !rules.acceptedCurrencies.includes(devise.toUpperCase())) {
      found.push({
        field: 'currency',
        source: 'latent',
        basis: 'observed_refusal',
        message: `La devise fournie (${devise.toUpperCase()}) n'est pas prise en charge ; convertissez le montant en EUR et ajustez la devise de la commande.`,
      })
    }
  }

  return found
}

/**
 * Lit l'activation depuis l'environnement. Desactive tant que la variable ne
 * vaut pas exactement 'true' : une detection qui se declenche par defaut
 * remplirait la file de tous les tenants d'un coup.
 */
export function latentRulesFromEnv(
  env: Record<string, string | undefined>,
): ValidationRules | null {
  return env.AUTO_FIX_LATENT_DETECTION === 'true' ? OBSERVED_RULES : null
}
