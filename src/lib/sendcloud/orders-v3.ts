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
  address_line_1?: string | null
  address_line_2?: string | null
  house_number?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
}

export interface OrderV3 {
  id: string
  order_number: string
  shipping_address?: OrderV3ShippingAddress
  order_details?: { status?: { code?: string } }
  /** Point relais choisi par le client, quand la methode en comporte un. */
  service_point_details?: { id?: string | null } | null
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
