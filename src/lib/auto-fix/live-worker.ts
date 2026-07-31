// Worker d'ecriture reelle. Conception :
// docs/plans/2026-07-25-auto-fix-write-engine-design.md (V2).
//
// Ce fichier est inerte tant qu'aucun tenant n'est en auto_fix_mode='live' ET
// que AUTO_FIX_LIVE_ENABLED ne vaut pas exactement 'true'.
//
// L'ordre des operations n'est pas negociable, il porte toute la surete :
//   1. les REPRISES d'abord, et elles ne peuvent que verifier ;
//   2. l'intention d'ecrire est commitee AVANT l'appel reseau ;
//   3. apres l'ecriture, plus aucun chemin ne peut re-ecrire.

import { createHash, randomUUID } from 'node:crypto'
import { planAddressShortening, type AddressLimit } from './address'
import { buildChfToEurConversion } from './currency'
import type { Json } from '@/types/database'
import { patchParcelById, comparePatch, type ParcelPatch, type WriteResult } from './sendcloud-write'
import {
  findOrderByNumber,
  patchOrderShippingAddress,
  patchOrderServicePoint,
  verifyOrderAddress,
  verifyOrderServicePoint,
  isCorrigible,
  type OrderV3,
  type OrderV3ShippingAddress,
} from '@/lib/sendcloud/orders-v3'
import {
  getServicePoint,
  findReplacementServicePoint,
} from '@/lib/sendcloud/service-points'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'

/**
 * Patterns autorises a ecrire. Fermes par defaut, ouverts un par un.
 *
 * Seul `address_too_long` est arme : c'est le seul pattern a la fois sur, non
 * bloque chez Sendcloud, et reellement observe (2 cas sur 60 jours ; le CHF
 * n'en a produit aucun — cf 2026-07-25-auto-fix-volume-reel.md).
 */
export const ARMED_LIVE_PATTERNS = ['address_too_long', 'service_point_missing'] as const

/**
 * Le remplacement de point relais est CALCULE mais pas applique, tant que
 * AUTO_FIX_SERVICE_POINT_AUTO ne vaut pas exactement 'true'.
 *
 * La distinction n'est pas de la prudence de facade. Raccourcir une adresse
 * conserve la destination ; changer de point relais la DEPLACE — le
 * destinataire ira retirer son colis ailleurs que la ou il pensait aller. On
 * veut donc que quelqu'un relise les premieres propositions, et pour cela il
 * faut qu'elles soient visibles : la proposition complete est enregistree dans
 * le plan, meme quand on refuse de l'appliquer.
 */
export function servicePointAutoApply(env: Record<string, string | undefined>): boolean {
  return env.AUTO_FIX_SERVICE_POINT_AUTO === 'true'
}

interface LiveJob {
  id: string
  tenant_id: string
  source_kind: string
  source_sendcloud_id: string
  source_fingerprint: string
  primary_pattern: string
  detected_patterns: string[]
  original_sendcloud_id: string
  source_summary_json: Record<string, unknown>
  plan_json?: { patch?: Record<string, unknown> } | null
  write_started_at?: string | null
}

export interface ParcelSnapshot {
  sendcloud_id: string
  status_id: number | null
  fingerprint: string
  date_announced?: string | null
  [field: string]: unknown
}

export interface LiveWorkerDependencies {
  credentials: (tenantId: string) => Promise<SendcloudCredentials | null>
  readParcel: (credentials: SendcloudCredentials, sendcloudId: string) => Promise<ParcelSnapshot | null>
  writeParcel?: (
    credentials: SendcloudCredentials,
    input: { id: string; patch: ParcelPatch },
  ) => Promise<WriteResult>
  /**
   * Numero de commande a partir de notre base. Le job ne porte que le
   * `shipment_uuid`, et l'API v3 ne l'expose pas : c'est le seul pont entre
   * les deux mondes.
   */
  resolveOrderRef?: (tenantId: string, sendcloudId: string) => Promise<string | null>
  findOrder?: typeof findOrderByNumber
  patchOrder?: typeof patchOrderShippingAddress
  verifyOrder?: typeof verifyOrderAddress
  /** Resout le taux CHF->EUR. Absent, la conversion n'est pas calculee. */
  chfRate?: () => Promise<unknown>
  getServicePoint?: typeof getServicePoint
  findServicePoint?: typeof findReplacementServicePoint
  patchServicePoint?: typeof patchOrderServicePoint
  verifyServicePoint?: typeof verifyOrderServicePoint
}

// ---------------------------------------------------------------------------
// Commandes importees
//
// L'API v2 ne sait pas les modifier — la ressource individuelle renvoie 404.
// L'API v3, si : OPTIONS /api/v3/orders/{id} declare GET, PATCH, DELETE. On
// fait donc par programme ce que l'exploitation fait avec le crayon du
// panneau, sans creer d'etiquette ni engager de frais.
//
// Les noms de champs different entre les deux mondes, d'ou la traduction
// ci-dessous. Elle est volontairement explicite : une correspondance implicite
// aurait laisse passer une adresse ecrite dans le mauvais champ.
// ---------------------------------------------------------------------------

function ordreVersAdresse(order: OrderV3): Record<string, unknown> {
  const a = order.shipping_address ?? {}
  return {
    address: a.address_line_1 ?? '',
    address_2: a.address_line_2 ?? '',
    house_number: a.house_number ?? '',
    city: a.city ?? '',
    postal_code: a.postal_code ?? '',
  }
}

function adresseVersOrdre(patch: Partial<Record<string, string>>): OrderV3ShippingAddress {
  const sortie: OrderV3ShippingAddress = {}
  if (patch.address !== undefined) sortie.address_line_1 = patch.address
  if (patch.address_2 !== undefined) sortie.address_line_2 = patch.address_2
  if (patch.house_number !== undefined) sortie.house_number = patch.house_number
  if (patch.city !== undefined) sortie.city = patch.city
  if (patch.postal_code !== undefined) sortie.postal_code = patch.postal_code
  return sortie
}

/**
 * Remplace un point relais devenu inexploitable.
 *
 * Ce chemin s'arrete AVANT d'ecrire tant que l'application automatique n'est
 * pas armee — mais il calcule quand meme la proposition complete et
 * l'enregistre. Un refus qui ne dit pas ce qu'il aurait fait n'apprend rien a
 * celui qui doit trancher.
 */
async function remplacerPointRelais(
  client: RpcClient,
  workerId: string,
  job: LiveJob,
  credentials: SendcloudCredentials,
  orderRef: string,
  env: Record<string, string | undefined>,
  deps: LiveWorkerDependencies,
  result: LiveWorkerResult,
  refuse: (reason: string, category?: string) => Promise<void>,
): Promise<void> {
  const findOrder = deps.findOrder ?? findOrderByNumber
  const lirePoint = deps.getServicePoint ?? getServicePoint
  const chercherRemplacant = deps.findServicePoint ?? findReplacementServicePoint

  const lookup = await findOrder(credentials, orderRef)
  if (!lookup.ok) {
    return refuse(`order_lookup_${lookup.reason}`, lookup.reason === 'http_error' ? 'retryable' : 'non_retryable')
  }
  const order = lookup.order
  if (!isCorrigible(order)) return refuse('order_not_corrigible')

  const actuelId = order.service_point_details?.id
  if (!actuelId) return refuse('service_point_absent')

  const actuel = await lirePoint(credentials, actuelId)
  if (!actuel.ok) {
    // Un acces non active ne se resout pas en reessayant.
    if (actuel.reason === 'unavailable') return refuse('service_points_not_activated', 'configuration')
    if (actuel.reason === 'http_error') return refuse('service_point_read_failed', 'retryable')
    // Point introuvable : il a disparu du reseau, on ne connait plus son
    // transporteur et on ne peut donc pas garantir de rester dessus.
    return refuse('service_point_unknown_carrier')
  }

  // Le point fonctionne encore : il n'y a rien a corriger, et l'erreur venait
  // d'ailleurs. Mieux vaut le dire que de deplacer un colis sans raison.
  if (actuel.point.is_active) return refuse('service_point_still_active')

  const remplacant = await chercherRemplacant(credentials, {
    carrier: actuel.point.carrier,
    country: actuel.point.country ?? order.shipping_address?.country_code ?? 'FR',
    postalCode: actuel.point.postal_code ?? order.shipping_address?.postal_code ?? '',
    origin: actuel.point,
    excludeId: actuel.point.id,
  })

  if (!remplacant.ok) {
    if (remplacant.reason === 'unavailable') return refuse('service_points_not_activated', 'configuration')
    if (remplacant.reason === 'http_error') return refuse('service_point_search_failed', 'retryable')
    return refuse('no_replacement_service_point')
  }

  // La proposition est enregistree AVANT toute decision d'appliquer : c'est
  // elle qui rend le refus relisible.
  const proposition = {
    action: 'patch_service_point_v3',
    from: { id: actuel.point.id, name: actuel.point.name, carrier: actuel.point.carrier, is_active: false },
    to: {
      id: remplacant.point.id,
      name: remplacant.point.name,
      carrier: remplacant.point.carrier,
      city: remplacant.point.city,
      postal_code: remplacant.point.postal_code,
    },
    distance_km: remplacant.distanceKm,
    radius_m: remplacant.radius,
    alternatives: remplacant.alternatives,
    patch: { service_point_id: String(remplacant.point.id) },
  }

  const planned = await rpc<boolean>(client, 'plan_auto_fix_live', {
    p_job_id: job.id, p_worker_id: workerId, p_plan: proposition,
  })
  if (!planned) { result.skipped += 1; return }

  if (!servicePointAutoApply(env)) {
    return refuse('service_point_proposal_awaiting_review')
  }

  const requestHash = createHash('sha256')
    .update(JSON.stringify({ order_id: order.id, service_point: remplacant.point.id }))
    .digest('hex')
  const begun = await rpc<boolean>(client, 'begin_auto_fix_write', {
    p_job_id: job.id, p_worker_id: workerId, p_request_hash: requestHash,
  })
  if (!begun) { result.skipped += 1; return }

  const ecrire = deps.patchServicePoint ?? patchOrderServicePoint
  const written = await ecrire(credentials, order, remplacant.point.id)
  result.written += 1

  if (!written.ok) {
    await client.rpc('fail_auto_fix_verification', {
      p_job_id: job.id, p_worker_id: workerId,
      p_error: { category: 'write_rejected', reason: written.reason, message: written.detail?.slice(0, 300) ?? null },
    })
    result.failed += 1
    return
  }

  await rpc<boolean>(client, 'mark_auto_fix_applied', {
    p_job_id: job.id, p_worker_id: workerId,
    p_result_sendcloud_id: job.original_sendcloud_id,
    p_before: { service_point_id: String(actuel.point.id) },
    p_after: { service_point_id: String(remplacant.point.id) },
    p_order_ref: orderRef,
  })

  const verifier = deps.verifyServicePoint ?? verifyOrderServicePoint
  const controle = await verifier(credentials, orderRef, remplacant.point.id)
  if (!controle.ok) {
    await client.rpc('fail_auto_fix_verification', {
      p_job_id: job.id, p_worker_id: workerId,
      p_error: { category: 'mismatch', fields: controle.ecarts.slice(0, 6) },
    })
    result.failed += 1
    return
  }

  await rpc<boolean>(client, 'verify_auto_fix_live', {
    p_job_id: job.id, p_worker_id: workerId,
    p_verification: { verified_fields: ['service_point_id'] },
  })
  result.verified += 1
}

/**
 * Corrige une commande importee de bout en bout, avec les memes invariants que
 * le chemin des colis : intention commitee avant l'octet envoye, aucune
 * reecriture possible ensuite, et confirmation par relecture seulement.
 */
async function corrigerCommandeImportee(
  client: RpcClient,
  workerId: string,
  job: LiveJob,
  env: Record<string, string | undefined>,
  deps: LiveWorkerDependencies,
  result: LiveWorkerResult,
  refuse: (reason: string, category?: string) => Promise<void>,
): Promise<void> {
  const resolveOrderRef = deps.resolveOrderRef
  if (!resolveOrderRef) return refuse('order_ref_resolver_missing', 'configuration')

  const findOrder = deps.findOrder ?? findOrderByNumber
  const patchOrder = deps.patchOrder ?? patchOrderShippingAddress
  const verifyOrder = deps.verifyOrder ?? verifyOrderAddress

  const credentials = await deps.credentials(job.tenant_id)
  if (!credentials) return refuse('credentials_missing', 'configuration')

  const orderRef = await resolveOrderRef(job.tenant_id, job.original_sendcloud_id)
  if (!orderRef) return refuse('order_ref_unknown')

  if (job.primary_pattern === 'service_point_missing') {
    return remplacerPointRelais(client, workerId, job, credentials, orderRef, env, deps, result, refuse)
  }

  const lookup = await findOrder(credentials, orderRef)
  if (!lookup.ok) {
    // `ambiguous` couvre aussi le cas ou l'API ignorerait le filtre : on ne
    // corrige jamais une commande qu'on n'a pas identifiee avec certitude.
    return refuse(`order_lookup_${lookup.reason}`, lookup.reason === 'http_error' ? 'retryable' : 'non_retryable')
  }
  const order = lookup.order
  if (!isCorrigible(order)) return refuse('order_not_corrigible')

  // Le plan est recalcule sur la lecture FRAICHE. Deux consequences voulues :
  // la valeur corrigee porte sur l'adresse actuelle, et si quelqu'un a deja
  // corrige a la main, il n'y a plus rien a raccourcir et on s'arrete.
  const limits = (job.source_summary_json.address_limits ?? []) as AddressLimit[]
  const plan = planAddressShortening(ordreVersAdresse(order), limits)
  if (plan.reason === 'nothing_to_shorten') return refuse('already_resolved')
  if (!plan.ready) return refuse(plan.reason)

  const patch = adresseVersOrdre(plan.patch as Partial<Record<string, string>>)

  const planned = await rpc<boolean>(client, 'plan_auto_fix_live', {
    p_job_id: job.id, p_worker_id: workerId,
    p_plan: { action: 'patch_order_v3', patch, audit: plan.audit },
  })
  if (!planned) { result.skipped += 1; return }

  const requestHash = createHash('sha256')
    .update(JSON.stringify({ order_id: order.id, patch }))
    .digest('hex')
  const begun = await rpc<boolean>(client, 'begin_auto_fix_write', {
    p_job_id: job.id, p_worker_id: workerId, p_request_hash: requestHash,
  })
  if (!begun) { result.skipped += 1; return }

  const written = await patchOrder(credentials, order, patch)
  result.written += 1

  if (!written.ok) {
    // L'ecriture a ete TENTEE : on ne repasse plus par le routeur pre-ecriture.
    await client.rpc('fail_auto_fix_verification', {
      p_job_id: job.id, p_worker_id: workerId,
      p_error: { category: 'write_rejected', reason: written.reason, message: written.detail?.slice(0, 300) ?? null },
    })
    result.failed += 1
    return
  }

  await rpc<boolean>(client, 'mark_auto_fix_applied', {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_result_sendcloud_id: job.original_sendcloud_id,
    p_before: { fields: Object.keys(patch) },
    p_after: patch,
    // Inscrit dans la trace : la ligne d'expedition est remplacee quand la
    // commande devient un colis, et la jointure ne retrouverait plus rien.
    p_order_ref: orderRef,
  })

  // On ne se fie pas au corps du PATCH : seule une relecture prouve que la
  // valeur a ete acceptee et conservee.
  const controle = await verifyOrder(credentials, orderRef, patch)
  if (!controle.ok) {
    await client.rpc('fail_auto_fix_verification', {
      p_job_id: job.id, p_worker_id: workerId,
      p_error: { category: 'mismatch', fields: controle.ecarts.slice(0, 6) },
    })
    result.failed += 1
    return
  }

  await rpc<boolean>(client, 'verify_auto_fix_live', {
    p_job_id: job.id, p_worker_id: workerId,
    p_verification: { verified_fields: Object.keys(patch) },
  })
  result.verified += 1
}

export interface LiveWorkerResult {
  mode: 'live'
  workerId: string
  tenants: number
  resumed: number
  claimed: number
  written: number
  verified: number
  skipped: number
  failed: number
}

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }

async function rpc<T>(client: RpcClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`${name}: ${(error as { message?: string }).message ?? 'rpc error'}`)
  return data as T
}

function asJob(value: unknown): LiveJob | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.tenant_id !== 'string') return null
  return {
    id: v.id,
    tenant_id: v.tenant_id,
    source_kind: String(v.source_kind ?? ''),
    source_sendcloud_id: String(v.source_sendcloud_id ?? ''),
    source_fingerprint: String(v.source_fingerprint ?? ''),
    primary_pattern: String(v.primary_pattern ?? ''),
    detected_patterns: Array.isArray(v.detected_patterns) ? v.detected_patterns.map(String) : [],
    original_sendcloud_id: String(v.original_sendcloud_id ?? v.source_sendcloud_id ?? ''),
    source_summary_json: (v.source_summary_json ?? {}) as Record<string, unknown>,
    plan_json: (v.plan_json ?? null) as LiveJob['plan_json'],
    write_started_at: (v.write_started_at as string | null) ?? null,
  }
}

/**
 * Statuts sur lesquels un PUT a encore un effet garanti.
 *
 * Liste blanche, et non un seuil. Le seuil `status_id >= 1000` que portait la
 * premiere version etait INVERSE au regard de la taxonomie reelle du projet
 * (ExpeditionsClient.tsx) : 1000 = Pret a envoyer et 1002 = Echec d'annonce
 * sont exactement la population a corriger, tandis que 1 = Annonce,
 * 3 = En transit et 11 = Livre sont ceux qu'il ne faut surtout pas toucher.
 * Le seuil refusait donc la cible et autorisait l'ecriture sur un colis deja
 * chez le transporteur, voire deja livre.
 *
 * 1001 (en cours d'annonce) est volontairement exclu : ecrire pendant
 * l'annonce est une course.
 */
const EDITABLE_STATUS_IDS = new Set([1000, 1002])

function isEditable(parcel: ParcelSnapshot): boolean {
  // Fail-closed : un statut inconnu ou absent n'autorise rien.
  if (typeof parcel.status_id !== 'number') return false
  if (parcel.date_announced) return false
  return EDITABLE_STATUS_IDS.has(parcel.status_id)
}

function buildPatch(job: LiveJob, parcel: ParcelSnapshot):
  | { ok: true; patch: ParcelPatch; audit: unknown }
  | { ok: false; reason: string } {
  if (job.primary_pattern !== 'address_too_long') {
    return { ok: false, reason: 'pattern_not_armed' }
  }

  const limits = (job.source_summary_json.address_limits ?? []) as AddressLimit[]
  const plan = planAddressShortening(parcel as Record<string, unknown>, limits)

  if (!plan.ready) {
    // Notamment `lossy_shortening_requires_review` : couper une ville peut
    // changer la destination, cela ne s'applique jamais tout seul.
    return { ok: false, reason: plan.reason }
  }
  return { ok: true, patch: plan.patch as ParcelPatch, audit: plan.audit }
}

/** Verifie une ecriture deja partie. Ne peut jamais re-ecrire. */
async function verifyOnly(
  client: RpcClient,
  workerId: string,
  job: LiveJob,
  deps: LiveWorkerDependencies,
  result: LiveWorkerResult,
): Promise<void> {
  try {
    const credentials = await deps.credentials(job.tenant_id)
    if (!credentials) throw new Error('identifiants Sendcloud indisponibles')

    const parcel = await deps.readParcel(credentials, job.original_sendcloud_id)
    if (!parcel) throw new Error('colis introuvable a la relecture')

    // Le patch reellement envoye vit dans plan_json, pose par plan_auto_fix_live.
    // La premiere version lisait source_summary_json.applied_patch, un champ
    // qu'AUCUN code n'ecrit : la comparaison portait sur un objet vide et
    // declarait donc "conforme" toute ecriture, y compris incertaine.
    const expected = (job.plan_json?.patch ?? {}) as ParcelPatch
    if (Object.keys(expected).length === 0) {
      // Un ensemble vide ne vaut JAMAIS "tout correspond" : sans patch attendu
      // on ne peut rien confirmer, donc on escalade.
      await client.rpc('fail_auto_fix_verification', {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_error: { category: 'verification_failed', reason: 'expected_patch_unavailable' },
      })
      result.failed += 1
      return
    }
    const comparison = comparePatch(expected, parcel as Record<string, unknown>)

    if (!comparison.matches) {
      await client.rpc('fail_auto_fix_verification', {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_error: { category: 'mismatch', fields: comparison.mismatched },
      })
      result.failed += 1
      return
    }

    await rpc<boolean>(client, 'verify_auto_fix_live', {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_verification: { verified_fields: Object.keys(expected) },
    })
    result.verified += 1
  } catch (error) {
    // Un echec de verification ne repasse JAMAIS par le routeur pre-ecriture :
    // celui-la replanifierait, donc reecrirait.
    await client.rpc('fail_auto_fix_verification', {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_error: {
        category: 'verification_failed',
        message: error instanceof Error ? error.message.slice(0, 300) : 'erreur inconnue',
      },
    })
    result.failed += 1
  }
}

export async function runAutoFixLiveWorker(
  client: RpcClient,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  deps?: LiveWorkerDependencies,
): Promise<LiveWorkerResult | { paused: true; reason: string }> {
  // Priorite des drapeaux, dans cet ordre exact. Chacun doit valoir exactement
  // la valeur attendue : toute autre valeur ferme la porte.
  if (env.AUTO_FIX_PAUSED !== 'false') return { paused: true, reason: 'auto_fix_paused' }
  if (env.AUTO_FIX_LIVE_ENABLED !== 'true') return { paused: true, reason: 'live_not_armed' }
  if (env.SYNC_PAUSED === 'true') return { paused: true, reason: 'sync_paused' }
  if (!deps) return { paused: true, reason: 'dependencies_missing' }

  const workerId = `live-${randomUUID()}`
  const write = deps.writeParcel ?? patchParcelById
  const result: LiveWorkerResult = {
    mode: 'live', workerId, tenants: 0, resumed: 0, claimed: 0,
    written: 0, verified: 0, skipped: 0, failed: 0,
  }

  const tenants = (await rpc<unknown[]>(client, 'get_auto_fix_live_tenants', { p_limit: 20 })) ?? []
  result.tenants = tenants.length

  for (const rawTenant of tenants) {
    const tenant = rawTenant as { tenant_id?: string; max_candidates?: number }
    if (!tenant?.tenant_id) continue
    const limit = Math.min(10, Math.max(1, tenant.max_candidates ?? 5))

    // 1. REPRISES D'ABORD. Ces jobs ont deja ecrit : seule la verification est
    //    permise, et aucun chemin d'ecriture n'est ouvert ici.
    const rawResume = (await rpc<unknown[]>(client, 'resume_auto_fix_writes', {
      p_tenant_id: tenant.tenant_id,
      p_worker_id: workerId,
      p_limit: limit,
    })) ?? []
    for (const raw of rawResume) {
      const job = asJob(raw)
      if (!job) continue
      result.resumed += 1
      await verifyOnly(client, workerId, job, deps, result)
    }

    // 2. Nouvelles ecritures.
    const rawJobs = (await rpc<unknown[]>(client, 'claim_auto_fix_jobs', {
      p_tenant_id: tenant.tenant_id,
      p_limit: limit,
      p_lock_seconds: 120,
      p_worker_id: workerId,
      p_mode: 'live',
    })) ?? []

    // Sequentiel : une ecriture externe irreversible ne se parallelise pas.
    for (const raw of rawJobs) {
      const job = asJob(raw)
      if (!job) continue
      result.claimed += 1

      const refuse = async (reason: string, category = 'non_retryable') => {
        result.skipped += 1
        await client.rpc('fail_auto_fix_live', {
          p_job_id: job.id, p_worker_id: workerId,
          p_error: { category, reason },
        })
      }

      try {
        if (!(ARMED_LIVE_PATTERNS as readonly string[]).includes(job.primary_pattern)) {
          // Un motif non arme est refuse, mais PAS en silence : quand on sait
          // calculer la correction, on l'enregistre avant de refuser. Sinon la
          // decision d'armer se prendrait a l'aveugle, sans jamais avoir vu ce
          // que l'outil proposerait. C'est le meme principe que pour le point
          // relais.
          if (job.primary_pattern === 'currency_chf' && deps.chfRate) {
            const taux = await deps.chfRate().catch(() => undefined)
            const conversion = buildChfToEurConversion(
              job.source_summary_json as Record<string, Json | undefined>,
              taux as never,
            )
            await rpc<boolean>(client, 'plan_auto_fix_live', {
              p_job_id: job.id, p_worker_id: workerId,
              p_plan: {
                action: 'convert_currency',
                proposal_only: true,
                ...(conversion.change as Record<string, unknown>),
              },
            })
          }
          await refuse('pattern_not_armed'); continue
        }
        // Une commande importee ne se corrige pas comme un colis : elle passe
        // par l'API v3, qui est la seule a savoir la modifier. Ce chemin est
        // complet, il ne retombe jamais sur celui des colis.
        if (job.source_kind !== 'parcel') {
          await corrigerCommandeImportee(client, workerId, job, env, deps, result, refuse)
          continue
        }

        const credentials = await deps.credentials(job.tenant_id)
        if (!credentials) { await refuse('credentials_missing', 'configuration'); continue }

        // Relecture avant ecriture : le colis a pu etre annonce, annule ou
        // modifie a la main depuis la detection.
        const parcel = await deps.readParcel(credentials, job.original_sendcloud_id)
        if (!parcel) { await refuse('parcel_not_found'); continue }
        if (!isEditable(parcel)) { await refuse('parcel_not_editable'); continue }
        if (parcel.fingerprint && parcel.fingerprint !== job.source_fingerprint) {
          await refuse('source_changed_since_detection'); continue
        }

        const built = buildPatch(job, parcel)
        if (!built.ok) { await refuse(built.reason); continue }

        const planned = await rpc<boolean>(client, 'plan_auto_fix_live', {
          p_job_id: job.id, p_worker_id: workerId,
          p_plan: { action: 'put_update', patch: built.patch, audit: built.audit },
        })
        if (!planned) { result.skipped += 1; continue }

        // LE point critique : l'intention est commitee avant l'octet envoye.
        const requestHash = createHash('sha256')
          .update(JSON.stringify({ id: job.original_sendcloud_id, patch: built.patch }))
          .digest('hex')
        const begun = await rpc<boolean>(client, 'begin_auto_fix_write', {
          p_job_id: job.id, p_worker_id: workerId, p_request_hash: requestHash,
        })
        // Bail perdu ou job deja parti en ecriture : on n'ecrit pas.
        if (!begun) { result.skipped += 1; continue }

        const written = await write(credentials, {
          id: job.original_sendcloud_id,
          patch: built.patch,
        })
        result.written += 1

        if (!written.ok) {
          // A partir d'ici l'ecriture a ete TENTEE : quel que soit l'echec, on
          // ne repasse plus jamais par le routeur pre-ecriture.
          await client.rpc('fail_auto_fix_verification', {
            p_job_id: job.id, p_worker_id: workerId,
            p_error: {
              category: written.failure?.applied === 'no' ? 'write_rejected' : 'write_uncertain',
              status: written.status ?? null,
              message: written.error?.slice(0, 300) ?? null,
            },
          })
          result.failed += 1
          continue
        }

        await rpc<boolean>(client, 'mark_auto_fix_applied', {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_result_sendcloud_id: written.resultSendcloudId ?? job.original_sendcloud_id,
          p_before: { fields: Object.keys(built.patch) },
          p_after: built.patch,
        })

        const after = await deps.readParcel(credentials, written.resultSendcloudId ?? job.original_sendcloud_id)
        const comparison = after
          ? comparePatch(built.patch, after as Record<string, unknown>)
          : { matches: false, mismatched: Object.keys(built.patch) }

        if (!comparison.matches) {
          await client.rpc('fail_auto_fix_verification', {
            p_job_id: job.id, p_worker_id: workerId,
            p_error: { category: 'mismatch', fields: comparison.mismatched },
          })
          result.failed += 1
          continue
        }

        await rpc<boolean>(client, 'verify_auto_fix_live', {
          p_job_id: job.id, p_worker_id: workerId,
          p_verification: { verified_fields: Object.keys(built.patch) },
        })
        result.verified += 1
      } catch (error) {
        result.failed += 1
        // Erreur AVANT toute tentative d'ecriture : le routeur pre-ecriture
        // refusera de lui-meme si write_started_at est deja pose.
        await client.rpc('fail_auto_fix_live', {
          p_job_id: job.id, p_worker_id: workerId,
          p_error: {
            category: 'internal',
            message: error instanceof Error ? error.message.slice(0, 300) : 'erreur inconnue',
          },
        })
      }
    }
  }

  return result
}
