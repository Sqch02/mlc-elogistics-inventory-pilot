import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { resolveAutoFixGate, workerBudgetMs, type AutoFixEnvironment } from './config'
import {
  createSupabaseExchangeRateRepository,
  resolveChfToEurRate,
  type ChfRateResolution,
} from './exchange-rate'
import { buildSimulationPlanFromJob } from './plan'
import { AUTO_FIX_PATTERNS, type ClaimedAutoFixJob } from './types'

interface RpcError { message: string }
interface RpcResult<T> { data: T | null; error: RpcError | null }

export interface AutoFixWorkerClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult<unknown>>
  from?: unknown
}

export interface AutoFixWorkerDependencies {
  resolveChfRate?: (client: AutoFixWorkerClient) => Promise<ChfRateResolution>
}

interface SimulatedTenant {
  tenant_id: string
  max_candidates: number
}

export interface AutoFixWorkerResult {
  mode: 'simulated'
  workerId: string
  tenants: number
  claimed: number
  simulated: number
  failed: number
  stoppedByBudget: boolean
  piiRedacted: number
  cleanupFailed: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseTenant(value: unknown): SimulatedTenant | null {
  if (!isObject(value) || typeof value.tenant_id !== 'string') return null
  const limit = Number(value.max_candidates)
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) return null
  return { tenant_id: value.tenant_id, max_candidates: limit }
}

function parseClaimedJob(value: unknown): ClaimedAutoFixJob | null {
  if (!isObject(value)) return null
  const patterns = Array.isArray(value.detected_patterns)
    ? value.detected_patterns.filter((item): item is ClaimedAutoFixJob['primary_pattern'] =>
      typeof item === 'string' && AUTO_FIX_PATTERNS.includes(item as ClaimedAutoFixJob['primary_pattern']))
    : []
  if (
    typeof value.id !== 'string' || typeof value.tenant_id !== 'string' ||
    typeof value.source_sendcloud_id !== 'string' || typeof value.source_fingerprint !== 'string' ||
    typeof value.operation_key !== 'string' || value.mode !== 'simulated' || patterns.length === 0 ||
    (value.source_kind !== 'parcel' && value.source_kind !== 'integration_shipment') ||
    typeof value.primary_pattern !== 'string' || !AUTO_FIX_PATTERNS.includes(value.primary_pattern as ClaimedAutoFixJob['primary_pattern'])
  ) return null
  return {
    id: value.id,
    tenant_id: value.tenant_id,
    shipment_id: typeof value.shipment_id === 'string' ? value.shipment_id : null,
    source_kind: value.source_kind,
    source_sendcloud_id: value.source_sendcloud_id,
    source_fingerprint: value.source_fingerprint,
    primary_pattern: value.primary_pattern as ClaimedAutoFixJob['primary_pattern'],
    detected_patterns: patterns,
    operation_key: value.operation_key,
    mode: 'simulated',
    evidence_json: (value.evidence_json ?? {}) as Json,
    source_summary_json: (value.source_summary_json ?? {}) as Json,
  }
}

async function rpcData<T>(
  client: AutoFixWorkerClient,
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}

async function resolveWorkerChfRate(client: AutoFixWorkerClient): Promise<ChfRateResolution> {
  if (typeof client.from !== 'function') return { ok: false, reason: 'cache_unavailable' }
  const repository = createSupabaseExchangeRateRepository(client as unknown as SupabaseClient<Database>)
  return resolveChfToEurRate(repository)
}

export async function runAutoFixDryRunWorker(
  client: AutoFixWorkerClient,
  env: AutoFixEnvironment = process.env,
  dependencies: AutoFixWorkerDependencies = {},
): Promise<AutoFixWorkerResult | { paused: true; reason: string }> {
  const gate = resolveAutoFixGate(env)
  if (!gate.enabled) return { paused: true, reason: gate.reason }

  const startedAt = Date.now()
  const budget = workerBudgetMs(env)
  const workerId = `dry-${randomUUID()}`
  const rawTenants = await rpcData<unknown[]>(client, 'get_auto_fix_simulated_tenants', { p_limit: 20 })
  const tenants = (rawTenants ?? []).map(parseTenant).filter((item): item is SimulatedTenant => item !== null)
  const result: AutoFixWorkerResult = {
    mode: 'simulated', workerId, tenants: tenants.length, claimed: 0,
    simulated: 0, failed: 0, stoppedByBudget: false, piiRedacted: 0,
    cleanupFailed: false,
  }
  let chfRatePromise: Promise<ChfRateResolution> | null = null
  const getChfRate = (): Promise<ChfRateResolution> => {
    if (!chfRatePromise) {
      chfRatePromise = (dependencies.resolveChfRate ?? resolveWorkerChfRate)(client)
    }
    return chfRatePromise
  }

  for (const tenant of tenants) {
    if (Date.now() - startedAt >= budget) {
      result.stoppedByBudget = true
      break
    }
    const rawJobs = await rpcData<unknown[]>(client, 'claim_auto_fix_jobs', {
      p_tenant_id: tenant.tenant_id,
      p_limit: tenant.max_candidates,
      p_lock_seconds: 120,
      p_worker_id: workerId,
    })
    const jobs = (rawJobs ?? []).map(parseClaimedJob).filter((item): item is ClaimedAutoFixJob => item !== null)
    result.claimed += jobs.length

    // Deliberately sequential. Dry-run never needs Sendcloud concurrency and a
    // future live adapter must opt in explicitly rather than inherit parallelism.
    for (const job of jobs) {
      try {
        const chfToEurRate = job.detected_patterns.includes('currency_chf')
          ? await getChfRate()
          : undefined
        const plan = buildSimulationPlanFromJob(job, { chfToEurRate })
        const planned = await rpcData<boolean>(client, 'plan_auto_fix_simulation', {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_plan: plan as unknown as Json,
        })
        if (!planned) throw new Error('job lease lost before planning')
        const completed = await rpcData<boolean>(client, 'complete_auto_fix_simulation', {
          p_job_id: job.id,
          p_worker_id: workerId,
        })
        if (!completed) throw new Error('job lease lost before simulation audit')
        result.simulated += 1
      } catch (error) {
        result.failed += 1
        await client.rpc('fail_auto_fix_simulation', {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_error: {
            message: error instanceof Error ? error.message.slice(0, 300) : 'unknown simulation error',
          },
        })
      }
    }
  }

  if (Date.now() - startedAt < budget) {
    try {
      result.piiRedacted = await rpcData<number>(client, 'cleanup_auto_fix_pii', { p_limit: 250 })
    } catch {
      // Retention cleanup is observable but must not turn completed simulations
      // into failures. The next dedicated worker run retries the bounded batch.
      result.cleanupFailed = true
    }
  }
  return result
}
