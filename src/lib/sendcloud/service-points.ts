// Points relais : lecture et recherche d'un remplacant.
//
// LE BESOIN. Un client choisit un point relais au moment de sa commande. Entre
// ce moment et l'impression de l'etiquette, le commerce peut fermer. Sendcloud
// refuse alors l'expedition, et quelqu'un doit choisir un autre relais a la
// main. C'est une part reelle des corrections quotidiennes.
//
// DEUX REGLES QUI NE SE NEGOCIENT PAS.
//
// On ne change JAMAIS de transporteur. Le tarif, le contrat et le delai en
// dependent, et le destinataire s'attend a l'enseigne qu'il a vue. Proposer un
// relais d'un autre reseau serait une decision commerciale, pas une correction.
//
// On propose le plus proche du CHOIX INITIAL du client, pas le plus proche de
// son domicile. Il a peut-etre choisi un relais pres de son travail ou sur son
// trajet ; le deplacer vers chez lui serait presumer de ses habitudes. On
// minimise donc l'ecart avec ce qu'il avait decide.

import type { SendcloudCredentials } from './types'

const SERVICE_POINTS_URL = 'https://servicepoints.sendcloud.sc/api/v2/service-points'

/** Rayons successifs, en metres. On s'arrete au premier qui donne un resultat. */
export const DEFAULT_RADII = [5000, 10000, 25000] as const

export interface ServicePoint {
  id: number
  name: string
  carrier: string
  is_active: boolean
  street?: string | null
  house_number?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
}

export type ServicePointLookup =
  | { ok: true; point: ServicePoint }
  | { ok: false; reason: 'not_found' | 'http_error' | 'unavailable'; detail?: string }

export type ReplacementResult =
  | { ok: true; point: ServicePoint; radius: number; distanceKm: number | null; alternatives: number }
  | { ok: false; reason: 'no_candidate' | 'http_error' | 'unavailable'; detail?: string }

function authHeader(credentials: SendcloudCredentials): string {
  return 'Basic ' + Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Distance a vol d'oiseau, suffisante pour classer des relais d'une meme ville. */
export function distanceKm(
  a: { latitude?: string | number | null; longitude?: string | number | null },
  b: { latitude?: string | number | null; longitude?: string | number | null },
): number | null {
  const lat1 = num(a.latitude), lon1 = num(a.longitude)
  const lat2 = num(b.latitude), lon2 = num(b.longitude)
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null

  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Lit un point relais par son identifiant. C'est ce qui donne son
 * TRANSPORTEUR — la commande ne porte qu'un identifiant, et le nom de methode
 * au checkout ("Livraison en point relais") ne dit pas de quel reseau il
 * s'agit.
 */
export async function getServicePoint(
  credentials: SendcloudCredentials,
  id: string | number,
  fetchImpl: typeof fetch = fetch,
): Promise<ServicePointLookup> {
  // La barre oblique finale n'est pas cosmetique : sans elle l'API redirige,
  // et on refuse les redirections (garde anti-redirection ouverte). Le premier
  // essai contre l'API reelle a echoue exactement la-dessus.
  const response = await fetchImpl(`${SERVICE_POINTS_URL}/${encodeURIComponent(String(id))}/`, {
    method: 'GET',
    redirect: 'error',
    headers: { Authorization: authHeader(credentials), 'Content-Type': 'application/json' },
  })

  if (response.status === 404) return { ok: false, reason: 'not_found' }
  if (response.status === 400) {
    // Le compte n'a pas l'acces aux points relais. Distinguer ce cas d'une
    // erreur passagere evite de reessayer indefiniment un reglage manquant.
    const detail = await response.text().catch(() => '')
    return { ok: false, reason: 'unavailable', detail: detail.slice(0, 200) }
  }
  if (!response.ok) return { ok: false, reason: 'http_error', detail: `HTTP ${response.status}` }

  const point = (await response.json()) as ServicePoint
  return { ok: true, point }
}

/**
 * Cherche un remplacant, du MEME transporteur, en elargissant le rayon par
 * paliers. On renvoie le plus proche du point d'origine, et le nombre
 * d'alternatives : un choix unique et un choix parmi vingt n'ont pas la meme
 * valeur pour qui relit la decision.
 */
export async function findReplacementServicePoint(
  credentials: SendcloudCredentials,
  input: {
    carrier: string
    country: string
    postalCode: string
    /** Point d'origine, pour classer les candidats par proximite de son choix. */
    origin?: Pick<ServicePoint, 'latitude' | 'longitude'>
    excludeId?: number | string
    radii?: readonly number[]
  },
  fetchImpl: typeof fetch = fetch,
): Promise<ReplacementResult> {
  const radii = input.radii ?? DEFAULT_RADII

  for (const radius of radii) {
    const url = `${SERVICE_POINTS_URL}/?country=${encodeURIComponent(input.country)}`
      + `&postal_code=${encodeURIComponent(input.postalCode)}`
      + `&radius=${radius}`
      + `&carrier=${encodeURIComponent(input.carrier)}`

    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      headers: { Authorization: authHeader(credentials), 'Content-Type': 'application/json' },
    })

    if (response.status === 400) {
      const detail = await response.text().catch(() => '')
      return { ok: false, reason: 'unavailable', detail: detail.slice(0, 200) }
    }
    if (!response.ok) return { ok: false, reason: 'http_error', detail: `HTTP ${response.status}` }

    const points = (await response.json()) as ServicePoint[]

    const candidats = points.filter((p) =>
      p.is_active === true
      // Garde-fou explicite : meme si le filtre de l'API est fiable, on ne
      // s'en remet pas a lui pour une decision qui engage une livraison.
      && p.carrier === input.carrier
      && String(p.id) !== String(input.excludeId ?? ''),
    )

    if (candidats.length === 0) continue

    const classes = input.origin
      ? [...candidats].sort((a, b) => {
          const da = distanceKm(input.origin!, a)
          const db = distanceKm(input.origin!, b)
          if (da === null) return 1
          if (db === null) return -1
          return da - db
        })
      : candidats

    const retenu = classes[0]
    return {
      ok: true,
      point: retenu,
      radius,
      distanceKm: input.origin ? distanceKm(input.origin, retenu) : null,
      alternatives: candidats.length - 1,
    }
  }

  return { ok: false, reason: 'no_candidate' }
}
