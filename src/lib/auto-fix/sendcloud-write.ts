// Chemin d'ecriture du moteur auto-fix.
//
// Volontairement separe de src/lib/sendcloud/client.ts : une fonction
// updateParcel y existe deja, mais elle utilise le chemin legacy
// /parcels/{id} et elle a un appelant vivant (la route de modification UI).
// Changer son contrat serait un changement de comportement sur un chemin qui
// n'a rien demande. Le moteur recoit donc sa propre fonction, testee pour lui.

import type { SendcloudCredentials } from '@/lib/sendcloud/types'

const SENDCLOUD_API_URL = 'https://panel.sendcloud.sc/api/v2'
const WRITE_TIMEOUT_MS = 15_000

export type ParcelPatch = Record<string, string | number | null>

export interface WriteFailureSignal {
  status?: number
  networkError?: boolean
  timeout?: boolean
}

/**
 * Categorie d'erreur, et surtout : la mutation a-t-elle pu etre appliquee ?
 *
 * `applied` est le champ qui compte. Seul 'no' autorise une nouvelle ecriture ;
 * 'unknown' impose de relire avant toute decision. La premiere version de la
 * conception rangeait les 5xx avec les 429 en "rejouable", ce qui autorisait un
 * second PUT alors qu'un 502 de passerelle signifie que l'origine a peut-etre
 * deja applique le changement.
 */
export interface WriteFailureClassification {
  category: 'non_retryable' | 'configuration' | 'retryable' | 'internal'
  applied: 'no' | 'unknown'
}

export function classifyWriteFailure(signal: WriteFailureSignal): WriteFailureClassification {
  if (signal.timeout || signal.networkError) {
    return { category: 'retryable', applied: 'unknown' }
  }

  const status = signal.status ?? 0

  if (status === 401 || status === 403) {
    return { category: 'configuration', applied: 'no' }
  }
  if (status === 429) {
    // Refuse avant d'atteindre l'origine : rien n'a ete applique.
    return { category: 'retryable', applied: 'no' }
  }
  if (status >= 400 && status < 500) {
    // Rejet de validation : la mutation est prouvablement non appliquee.
    return { category: 'non_retryable', applied: 'no' }
  }
  if (status >= 500) {
    // L'origine a pu appliquer avant de renvoyer l'erreur.
    return { category: 'retryable', applied: 'unknown' }
  }
  return { category: 'internal', applied: 'unknown' }
}

export interface WriteResult {
  ok: boolean
  status?: number
  resultSendcloudId?: string
  failure?: WriteFailureClassification
  error?: string
}

export async function patchParcelById(
  credentials: SendcloudCredentials,
  input: { id: string; patch: ParcelPatch },
): Promise<WriteResult> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return { ok: false, error: 'Ecriture impossible en mode simulation' }
  }

  const fields = Object.keys(input.patch)
  if (fields.length === 0) {
    // Un PUT vide serait une ecriture reelle sans aucun effet attendu.
    return { ok: false, error: 'Patch vide' }
  }

  const numericId = Number(input.id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    return { ok: false, error: 'Identifiant de colis non numerique' }
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS)

  try {
    const response = await fetch(`${SENDCLOUD_API_URL}/parcels`, {
      method: 'PUT',
      // Contrat valide sur colis de test : l'identifiant va dans le CORPS,
      // pas dans le chemin.
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parcel: { id: numericId, ...input.patch } }),
    })

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        failure: classifyWriteFailure({ status: response.status }),
        error: `Sendcloud a repondu ${response.status}`,
      }
    }

    const payload = await response.json().catch(() => null)
    const returnedId = payload?.parcel?.id
    return {
      ok: true,
      status: response.status,
      resultSendcloudId: returnedId ? String(returnedId) : input.id,
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      ok: false,
      failure: classifyWriteFailure(aborted ? { timeout: true } : { networkError: true }),
      error: error instanceof Error ? error.message : 'Erreur reseau',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Confirme qu'un patch a reellement atterri, en relisant le colis.
 *
 * On ne fait jamais confiance au seul code retour. Mais on ne confond pas non
 * plus une difference de mise en forme introduite par Sendcloud (espaces,
 * casse, "1.500" contre "1.5") avec un echec d'ecriture : ce serait envoyer en
 * revue humaine des corrections parfaitement appliquees.
 */
export function comparePatch(
  patch: ParcelPatch,
  actual: Record<string, unknown>,
): { matches: boolean; mismatched: string[] } {
  const mismatched: string[] = []

  for (const [field, expected] of Object.entries(patch)) {
    const found = actual[field]

    if (found === undefined || found === null) {
      if (expected !== null) mismatched.push(field)
      continue
    }

    const expectedNumber = Number(expected)
    const foundNumber = Number(found)
    if (
      expected !== null && String(expected).trim() !== '' &&
      Number.isFinite(expectedNumber) && Number.isFinite(foundNumber)
    ) {
      if (expectedNumber !== foundNumber) mismatched.push(field)
      continue
    }

    const normalize = (value: unknown) =>
      String(value).trim().toLowerCase().replace(/\s+/g, ' ')
    if (normalize(expected) !== normalize(found)) mismatched.push(field)
  }

  return { matches: mismatched.length === 0, mismatched }
}
