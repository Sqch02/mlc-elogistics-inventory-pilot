import type { Json } from '@/types/database'
import { buildOperationKey, sha256 } from './fingerprint'
import { detectAutoFixCause } from './detect'
import type {
  AutoFixCandidateJob,
  CandidateSource,
  TenantFixDefaults,
} from './types'

interface RpcResult<T> {
  data: T | null
  error: { message: string } | null
}

export interface AutoFixEnqueueClient {
  rpc(name: 'enqueue_auto_fix_jobs', args: { p_jobs: Json }): PromiseLike<RpcResult<number>>
}

function sourceKind(sendcloudId: string): 'parcel' | 'integration_shipment' {
  return /^\d+$/.test(sendcloudId) ? 'parcel' : 'integration_shipment'
}

function sourceObservedAt(source: CandidateSource): string {
  const raw = source.shipment.raw_json
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, Json | undefined>
    for (const key of ['date_updated', 'updated_at', 'created_at']) {
      if (typeof record[key] === 'string' && !Number.isNaN(Date.parse(record[key]))) return record[key]
    }
  }
  return source.shipment.date_updated ?? source.shipment.date_created ?? source.shipment.shipped_at
}

function priorityFor(pattern: AutoFixCandidateJob['primary_pattern']): number {
  if (pattern === 'sender_eori_missing') return 300
  if (pattern === 'unknown') return 50
  return 100
}

export function buildAutoFixCandidate(
  tenantId: string,
  source: CandidateSource,
  defaults: TenantFixDefaults,
): AutoFixCandidateJob | null {
  const kind = sourceKind(source.shipment.sendcloud_id)
  const detection = detectAutoFixCause(source.shipment.raw_json, kind)
  if (!detection) return null
  const operationKey = buildOperationKey({
    tenantId,
    sourceKind: kind,
    sourceSendcloudId: source.shipment.sendcloud_id,
    sourceFingerprint: detection.sourceFingerprint,
    patterns: detection.detectedPatterns,
    mode: 'simulated',
  })

  return {
    tenant_id: tenantId,
    shipment_id: source.shipmentId,
    source_kind: kind,
    source_sendcloud_id: source.shipment.sendcloud_id,
    source_order_ref_hash: source.shipment.order_ref ? sha256(source.shipment.order_ref) : null,
    source_fingerprint: detection.sourceFingerprint,
    primary_pattern: detection.primaryPattern,
    detected_patterns: detection.detectedPatterns,
    mode: 'simulated',
    operation_key: operationKey,
    priority: priorityFor(detection.primaryPattern),
    evidence_json: { evidence: detection.evidence } as unknown as Json,
    source_summary_json: {
      ...detection.sourceSummary,
      tenant_default_hs_configured: Boolean(defaults.defaultHsCode),
      tenant_default_origin_configured: Boolean(defaults.defaultOriginCountry),
    } as unknown as Json,
    original_sendcloud_id: source.shipment.sendcloud_id,
    source_observed_at: sourceObservedAt(source),
  }
}

export async function enqueueAutoFixCandidates(
  client: AutoFixEnqueueClient,
  tenantId: string,
  sources: CandidateSource[],
  defaults: TenantFixDefaults,
): Promise<{ detected: number; enqueuedOrSeen: number }> {
  const jobs = sources
    .map((source) => buildAutoFixCandidate(tenantId, source, defaults))
    .filter((job): job is AutoFixCandidateJob => job !== null)
  if (jobs.length === 0) return { detected: 0, enqueuedOrSeen: 0 }

  const { data, error } = await client.rpc('enqueue_auto_fix_jobs', {
    p_jobs: jobs as unknown as Json,
  })
  if (error) throw new Error(`enqueue_auto_fix_jobs: ${error.message}`)
  return { detected: jobs.length, enqueuedOrSeen: data ?? 0 }
}
