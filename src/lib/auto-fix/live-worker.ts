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
import { patchParcelById, comparePatch, type ParcelPatch, type WriteResult } from './sendcloud-write'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'

/**
 * Patterns autorises a ecrire. Fermes par defaut, ouverts un par un.
 *
 * Seul `address_too_long` est arme : c'est le seul pattern a la fois sur, non
 * bloque chez Sendcloud, et reellement observe (2 cas sur 60 jours ; le CHF
 * n'en a produit aucun — cf 2026-07-25-auto-fix-volume-reel.md).
 */
export const ARMED_LIVE_PATTERNS = ['address_too_long'] as const

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
          await refuse('pattern_not_armed'); continue
        }
        // La creation liee via shipment_uuid n'est pas validee : on n'ecrit
        // que sur des colis numeriques.
        if (job.source_kind !== 'parcel') {
          await refuse('integration_shipment_not_supported'); continue
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
