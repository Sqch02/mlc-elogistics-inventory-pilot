// Correction d'une commande importee, via l'API Orders v3.
//
// POURQUOI CE MODULE EXISTE
// L'API v2 ne permet pas de modifier une commande importee : la ressource
// individuelle `/api/v2/integrations/{id}/shipments/{uuid}` renvoie 404 et
// aucune route alternative ne repond. Longtemps, la seule facon de corriger
// une adresse trop longue etait donc le crayon du panneau, a la main, chaque
// soir.
//
// L'API v3 expose en revanche une ressource par commande, et elle est
// modifiable. Verifie en direct le 27/07 :
//
//     OPTIONS /api/v3/orders/{id}   ->   Allow: GET, PATCH, DELETE
//
// C'est ce qui rend l'automatisation possible : on fait exactement ce que fait
// l'exploitant avec le crayon, sans creer d'etiquette ni engager de frais.
//
// PRECAUTION CENTRALE
// Une commande deja expediee ne se corrige pas : la modifier n'aurait aucun
// effet sur une etiquette imprimee, et masquerait le probleme reel. On refuse
// donc tout ce qui n'est pas encore en attente de traitement.

import type { SendcloudCredentials } from './types'

const ORDERS_V3_URL = 'https://panel.sendcloud.sc/api/v3/orders'

/** Statuts pour lesquels une correction a encore un sens. */
const CORRIGIBLE_STATUS = new Set(['on_hold', 'unfulfilled'])

export interface OrderV3ShippingAddress {
  /**
   * Le nom du destinataire fait partie de l'adresse d'expedition chez
   * Sendcloud, et il porte sa propre limite de longueur. Il manquait ici, donc
   * le moteur ne le voyait jamais — cf `ordreVersAdresse`.
   */
  name?: string | null
  company_name?: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  house_number?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
  /** Sert a reconnaitre un e-mail recopie dans le champ nom. */
  email?: string | null
}

export interface OrderV3 {
  id: string
  order_number: string
  shipping_address?: OrderV3ShippingAddress
  order_details?: { status?: { code?: string } }
  /** Point relais choisi par le client, quand la methode en comporte un. */
  service_point_details?: { id?: string | null } | null
  payment_details?: Record<string, unknown> | null
}

/** Un montant tel que l'API v3 le represente. */
export interface MoneyV3 { value: number; currency: string }

/** Les champs monetaires d'une commande, tous convertibles ensemble. */
const MONEY_FIELDS = [
  'subtotal_price',
  'estimated_shipping_price',
  'estimated_tax_price',
  'total_price',
  'discount_granted',
  'freight_costs',
] as const

function isMoney(value: unknown): value is MoneyV3 {
  return Boolean(value) && typeof value === 'object'
    && typeof (value as MoneyV3).value === 'number'
    && typeof (value as MoneyV3).currency === 'string'
}

/**
 * Convertit les montants d'une commande vers l'euro.
 *
 * LE TAUX EST APPLIQUE A CHAQUE MONTANT SEPAREMENT, et c'est un choix. On
 * pourrait convertir le total puis repartir, ce qui garantirait que la somme
 * tombe juste — mais les montants d'origine ne sont deja pas coherents entre
 * eux (48 + 8 + 0,60 donne 56,60 pour un total annonce a 56). Repartir un
 * total impliquerait donc de decider quel montant est faux, ce qui n'est pas
 * a nous. On convertit fidelement ce qui est declare.
 *
 * `chfPerEur` est le taux publie par la Banque centrale europeenne : combien
 * de francs vaut un euro. Convertir va donc dans le sens de la DIVISION.
 */
export function convertPaymentDetails(
  paymentDetails: Record<string, unknown> | null | undefined,
  chfPerEur: number,
): { patch: Record<string, MoneyV3>; converted: number } {
  const patch: Record<string, MoneyV3> = {}
  if (!paymentDetails || !Number.isFinite(chfPerEur) || chfPerEur <= 0) {
    return { patch, converted: 0 }
  }

  for (const champ of MONEY_FIELDS) {
    const montant = paymentDetails[champ]
    if (!isMoney(montant) || montant.currency.toUpperCase() !== 'CHF') continue
    patch[champ] = {
      value: Math.round((montant.value / chfPerEur) * 100) / 100,
      currency: 'EUR',
    }
  }

  return { patch, converted: Object.keys(patch).length }
}

export type OrderLookup =
  | { ok: true; order: OrderV3 }
  | { ok: false; reason: 'not_found' | 'ambiguous' | 'http_error'; detail?: string }

export type OrderPatchResult =
  | { ok: true; order: OrderV3 }
  | { ok: false; reason: 'not_corrigible' | 'http_error' | 'unchanged'; detail?: string }

function authHeader(credentials: SendcloudCredentials): string {
  return 'Basic ' + Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')
}

function statusCode(order: OrderV3): string {
  return order.order_details?.status?.code ?? ''
}

export function isCorrigible(order: OrderV3): boolean {
  return CORRIGIBLE_STATUS.has(statusCode(order))
}

/**
 * Retrouve une commande par son numero. Le filtre `order_number` est le SEUL
 * qui soit reellement applique par l'API : `search`, `query` et
 * `filter[order_number]` sont ignores en silence et renvoient la collection
 * entiere. Verifie en direct — d'ou le controle strict du resultat ci-dessous,
 * qui refuse plutot que de corriger la mauvaise commande.
 */
export async function findOrderByNumber(
  credentials: SendcloudCredentials,
  orderNumber: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OrderLookup> {
  const url = `${ORDERS_V3_URL}?order_number=${encodeURIComponent(orderNumber)}`
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'error',
    headers: { Authorization: authHeader(credentials), 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    return { ok: false, reason: 'http_error', detail: `HTTP ${response.status}` }
  }

  const body = (await response.json()) as { data?: OrderV3[] }
  const rows = (body.data ?? []).filter((row) => row?.order_number === orderNumber)

  if (rows.length === 0) return { ok: false, reason: 'not_found' }
  // Plusieurs commandes portant le meme numero : on ne devine pas laquelle
  // corriger. Un filtre non applique renverrait ici toute la collection, et
  // ce garde-fou l'attrape aussi.
  if (rows.length > 1) return { ok: false, reason: 'ambiguous', detail: `${rows.length} correspondances` }

  return { ok: true, order: rows[0] }
}

/**
 * Corrige l'adresse d'expedition. Seuls les champs fournis sont transmis : on
 * n'envoie jamais l'adresse entiere, pour ne pas reecrire par megarde une
 * valeur qu'un humain aurait modifiee entre-temps.
 */
export async function patchOrderShippingAddress(
  credentials: SendcloudCredentials,
  order: OrderV3,
  patch: OrderV3ShippingAddress,
  fetchImpl: typeof fetch = fetch,
): Promise<OrderPatchResult> {
  if (!isCorrigible(order)) {
    return { ok: false, reason: 'not_corrigible', detail: statusCode(order) || 'statut inconnu' }
  }

  const champs = Object.entries(patch).filter(([, value]) => value !== undefined)
  if (champs.length === 0) {
    // Un PATCH vide serait une ecriture reelle sans effet attendu.
    return { ok: false, reason: 'unchanged', detail: 'aucun champ a corriger' }
  }

  const response = await fetchImpl(`${ORDERS_V3_URL}/${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    redirect: 'error',
    headers: { Authorization: authHeader(credentials), 'Content-Type': 'application/json' },
    body: JSON.stringify({ shipping_address: Object.fromEntries(champs) }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return { ok: false, reason: 'http_error', detail: `HTTP ${response.status} ${detail.slice(0, 200)}` }
  }

  const body = (await response.json().catch(() => ({}))) as { data?: OrderV3 }
  return { ok: true, order: body.data ?? order }
}

/**
 * Relit la commande et confirme que la correction est bien en place. On ne se
 * fie pas au corps de la reponse du PATCH : seule une relecture prouve que la
 * valeur a ete acceptee et conservee.
 */
export async function verifyOrderAddress(
  credentials: SendcloudCredentials,
  orderNumber: string,
  attendu: OrderV3ShippingAddress,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; ecarts: string[] }> {
  const lookup = await findOrderByNumber(credentials, orderNumber, fetchImpl)
  if (!lookup.ok) return { ok: false, ecarts: [`relecture impossible (${lookup.reason})`] }

  const actuel = lookup.order.shipping_address ?? {}
  const ecarts: string[] = []
  for (const [champ, valeur] of Object.entries(attendu)) {
    if (valeur === undefined) continue
    const obtenu = (actuel as Record<string, unknown>)[champ]
    if (obtenu !== valeur) ecarts.push(`${champ}: attendu "${valeur}", obtenu "${String(obtenu)}"`)
  }
  return { ok: ecarts.length === 0, ecarts }
}


/**
 * Remplace le point relais d'une commande.
 *
 * Separee de la correction d'adresse, et pas par gout de la symetrie : les
 * deux n'engagent pas la meme chose. Raccourcir une adresse conserve la
 * destination ; changer de point relais la DEPLACE. Le destinataire ira
 * ailleurs que la ou il pensait aller. On garde donc ce chemin distinct, avec
 * sa propre verification.
 */
export async function patchOrderServicePoint(
  credentials: SendcloudCredentials,
  order: OrderV3,
  servicePointId: string | number,
  fetchImpl: typeof fetch = fetch,
): Promise<OrderPatchResult> {
  if (!isCorrigible(order)) {
    return { ok: false, reason: 'not_corrigible', detail: statusCode(order) || 'statut inconnu' }
  }

  const cible = String(servicePointId)
  if (!cible || cible === String(order.service_point_details?.id ?? '')) {
    // Reecrire la meme valeur serait une ecriture reelle sans effet attendu.
    return { ok: false, reason: 'unchanged', detail: 'point relais identique' }
  }

  const response = await fetchImpl(`${ORDERS_V3_URL}/${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    redirect: 'error',
    headers: { Authorization: authHeader(credentials), 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_point_details: { id: cible } }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return { ok: false, reason: 'http_error', detail: `HTTP ${response.status} ${detail.slice(0, 200)}` }
  }

  const body = (await response.json().catch(() => ({}))) as { data?: OrderV3 }
  return { ok: true, order: body.data ?? order }
}

/**
 * Confirme par RELECTURE que le point relais est bien celui attendu. Le corps
 * de la reponse au PATCH ne renvoie que l'identifiant de commande : il ne
 * prouve rien sur la valeur conservee.
 */
export async function verifyOrderServicePoint(
  credentials: SendcloudCredentials,
  orderNumber: string,
  attendu: string | number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; ecarts: string[] }> {
  const lookup = await findOrderByNumber(credentials, orderNumber, fetchImpl)
  if (!lookup.ok) return { ok: false, ecarts: [`relecture impossible (${lookup.reason})`] }

  const obtenu = String(lookup.order.service_point_details?.id ?? '')
  if (obtenu !== String(attendu)) {
    return { ok: false, ecarts: [`service_point: attendu "${attendu}", obtenu "${obtenu}"`] }
  }
  return { ok: true, ecarts: [] }
}


/**
 * Applique la conversion de devise. Separee des autres ecritures, car elle
 * touche un montant declare — a la douane comme au client — la ou une adresse
 * ne change que l'acheminement.
 */
export async function patchOrderCurrency(
  credentials: SendcloudCredentials,
  order: OrderV3,
  chfPerEur: number,
  fetchImpl: typeof fetch = fetch,
): Promise<OrderPatchResult & { converted?: number }> {
  if (!isCorrigible(order)) {
    return { ok: false, reason: 'not_corrigible', detail: statusCode(order) || 'statut inconnu' }
  }

  const { patch, converted } = convertPaymentDetails(order.payment_details, chfPerEur)
  if (converted === 0) {
    return { ok: false, reason: 'unchanged', detail: 'aucun montant en CHF a convertir' }
  }

  const response = await fetchImpl(`${ORDERS_V3_URL}/${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    redirect: 'error',
    headers: { Authorization: authHeader(credentials), 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_details: patch }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return { ok: false, reason: 'http_error', detail: `HTTP ${response.status} ${detail.slice(0, 200)}` }
  }

  const body = (await response.json().catch(() => ({}))) as { data?: OrderV3 }
  return { ok: true, order: body.data ?? order, converted }
}

/** Confirme par relecture que la commande est bien passee en euros. */
export async function verifyOrderCurrency(
  credentials: SendcloudCredentials,
  orderNumber: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; ecarts: string[] }> {
  const lookup = await findOrderByNumber(credentials, orderNumber, fetchImpl)
  if (!lookup.ok) return { ok: false, ecarts: [`relecture impossible (${lookup.reason})`] }

  const restants = MONEY_FIELDS.filter((champ) => {
    const montant = lookup.order.payment_details?.[champ]
    return isMoney(montant) && montant.currency.toUpperCase() !== 'EUR'
  })

  return restants.length === 0
    ? { ok: true, ecarts: [] }
    : { ok: false, ecarts: restants.map((c) => `${c}: encore en devise etrangere`) }
}
