import { describe, expect, it } from 'vitest'
import { buildDigitalItemsPlan, POIDS_ARTICLE_DEMATERIALISE_KG } from './digital-items'

// Valeurs par defaut reellement configurees pour le client concerne.
const DEFAUTS = { hs_code: '210690', country_of_origin: 'DE' }

const article = (over: Record<string, unknown> = {}) => ({
  measurement: { weight: { value: 0.1, unit: 'kg' } },
  hs_code: '210690',
  country_of_origin: 'FR',
  quantity: 1,
  ...over,
})

describe('articles dematerialises', () => {
  it('renseigne poids, code SH et origine sur un article qui n a rien', () => {
    // Le cas decrit par l'exploitation : elle met 0,001 kg et recopie les
    // memes valeurs douanieres a chaque fois.
    const plan = buildDigitalItemsPlan(
      [article({ measurement: null, hs_code: null, country_of_origin: null })],
      DEFAUTS,
    )
    expect(plan.ok).toBe(true)
    expect(plan.items).toEqual([{
      index: 0,
      weight_kg: POIDS_ARTICLE_DEMATERIALISE_KG,
      hs_code: '210690',
      country_of_origin: 'DE',
    }])
  })

  it('ajuste AUSSI le poids de la commande', () => {
    // Le point que l'exploitation a explicitement signale : sans cela, la
    // commande reste en erreur. Une correction portant seulement sur l'article
    // aurait paru fonctionner sans rien resoudre.
    const plan = buildDigitalItemsPlan(
      [
        article({ measurement: null, hs_code: null, country_of_origin: null }),
        article({ measurement: { weight: { value: 0.185, unit: 'kg' } } }),
      ],
      DEFAUTS,
      185,
    )
    expect(plan.ok).toBe(true)
    // 0,001 + 0,185 = 0,186 kg = 186 g
    expect(plan.order_weight_grams).toBe(186)
    expect(plan.order_weight_grams_before).toBe(185)
  })

  it('tient compte des quantites', () => {
    const plan = buildDigitalItemsPlan(
      [article({ measurement: null, hs_code: null, country_of_origin: null, quantity: 3 })],
      DEFAUTS,
    )
    // 0,001 x 3 = 0,003 kg -> 3 g
    expect(plan.order_weight_grams).toBe(3)
  })

  it('ne confond pas les grammes et les kilogrammes', () => {
    // L'API melange les unites : l'article est en kg, la commande en grammes.
    // Confondre produirait un poids mille fois trop grand, donc un tarif faux.
    const plan = buildDigitalItemsPlan(
      [
        article({ measurement: null, hs_code: null, country_of_origin: null }),
        article({ measurement: { weight: { value: 250, unit: 'g' } } }),
      ],
      DEFAUTS,
    )
    expect(plan.order_weight_grams).toBe(251)
  })

  it('ne touche pas a un article complet', () => {
    expect(buildDigitalItemsPlan([article()], DEFAUTS).ok).toBe(false)
    expect(buildDigitalItemsPlan([article()], DEFAUTS).reason).toBe('nothing_to_fix')
  })

  it('conserve les valeurs douanieres deja presentes', () => {
    // Seul le poids manque : on n'ecrase pas une origine renseignee par une
    // valeur par defaut, elle serait peut-etre fausse.
    const plan = buildDigitalItemsPlan(
      [article({ measurement: null })],
      DEFAUTS,
    )
    expect(plan.items[0]).toEqual({ index: 0, weight_kg: POIDS_ARTICLE_DEMATERIALISE_KG })
    expect(plan.items[0].country_of_origin).toBeUndefined()
  })

  it('REFUSE de fabriquer un code douanier absent de la configuration', () => {
    // Inventer un code SH serait une declaration fausse.
    const plan = buildDigitalItemsPlan(
      [article({ measurement: null, hs_code: null, country_of_origin: null })],
      { hs_code: null, country_of_origin: 'DE' },
    )
    expect(plan.ok).toBe(false)
    expect(plan.reason).toContain('tenant_defaults_missing')
    expect(plan.reason).toContain('hs_code')
    expect(plan.items).toEqual([])
  })

  it('ne propose rien sans article', () => {
    expect(buildDigitalItemsPlan([], DEFAUTS).ok).toBe(false)
  })

  it('ne descend jamais sous un gramme pour la commande', () => {
    // Un poids nul serait refuse a son tour.
    const plan = buildDigitalItemsPlan(
      [article({ measurement: null, hs_code: null, country_of_origin: null })],
      DEFAUTS,
    )
    expect(plan.order_weight_grams).toBeGreaterThanOrEqual(1)
  })
})

describe('forme plate des colis (API v2)', () => {
  // Articles copies tels quels depuis une commande reelle. C'est elle qui a
  // revele le defaut : en ne lisant que la forme v3, le moteur croyait TOUS
  // les articles sans poids ni origine, et proposait de ramener une commande
  // de 271 g a 2 g. Les tests unitaires ne l'avaient pas vu.
  const REELS = [
    { sku: 'FLRN-HYPPDP-MOTI', weight: '0.001', hs_code: '210690', origin_country: 'FR', quantity: 1 },
    { sku: 'FLRNBU-PPOIDS-X3HY', weight: '0.270', hs_code: '210690', origin_country: 'FR', quantity: 1 },
  ]

  it('ne touche a rien quand tout est deja renseigne', () => {
    const plan = buildDigitalItemsPlan(REELS, DEFAUTS)
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe('nothing_to_fix')
  })

  it('lit un poids ecrit en chaine de caracteres', () => {
    const plan = buildDigitalItemsPlan(
      [{ weight: '0', hs_code: '210690', origin_country: 'FR', quantity: 1 }, REELS[1]],
      DEFAUTS,
    )
    expect(plan.ok).toBe(true)
    // 0,001 + 0,270 = 0,271 kg. Le defaut produisait 2 g.
    expect(plan.order_weight_grams).toBe(271)
    expect(plan.items).toHaveLength(1)
  })

  it('reconnait origin_country comme country_of_origin', () => {
    // Deux noms pour la meme information selon l'API. N'en lire qu'un ferait
    // ecraser une origine correcte par une valeur par defaut.
    const plan = buildDigitalItemsPlan(
      [{ weight: '0', hs_code: '210690', origin_country: 'FR', quantity: 1 }],
      DEFAUTS,
    )
    expect(plan.items[0].country_of_origin).toBeUndefined()
  })

  it('renseigne l origine quand elle manque vraiment', () => {
    const plan = buildDigitalItemsPlan(
      [{ weight: '0', hs_code: '210690', origin_country: null, quantity: 1 }],
      DEFAUTS,
    )
    expect(plan.items[0].country_of_origin).toBe('DE')
  })
})
