import type { ParsedShipment } from '@/lib/sendcloud/types'
import { detectAutoFixCause } from './detect'
import { enqueueAutoFixCandidates, type AutoFixEnqueueClient } from './queue'
import type { CandidateSource, TenantFixDefaults } from './types'
import type { ValidationRules } from './validate'
import type { AutoFixMode } from './types'

export interface AutoFixSyncIngestResult {
  observed: number
  eligible: number
  resolved: number
  detected: number
  enqueuedOrSeen: number
  truncated: boolean
}

export type ResolveShipmentIds = (sendcloudIds: string[]) => Promise<Map<string, string>>

function inferSourceKind(sendcloudId: string): 'parcel' | 'integration_shipment' {
  return /^\d+$/.test(sendcloudId) ? 'parcel' : 'integration_shipment'
}

/**
 * Detects only inside the already-bounded Sendcloud response held by the sync.
 * It never reads shipments itself; the caller resolves at most `cap` IDs using
 * the existing (tenant_id, sendcloud_id) unique index.
 */
export async function enqueueDetectedSyncBatch(
  client: AutoFixEnqueueClient,
  tenantId: string,
  shipments: ParsedShipment[],
  defaults: TenantFixDefaults,
  resolveShipmentIds: ResolveShipmentIds,
  cap: number,
  // Les MEMES regles doivent servir au filtre et a la construction : si les
  // deux divergent, le filtre retient une commande que le constructeur
  // rejettera, et le compte d'eligibles ne veut plus rien dire.
  latentRules: ValidationRules | null = null,
  // Doit suivre le mode du client, sinon la tache creee ne sera jamais
  // reclamable : la reclamation exige que les deux coincident.
  mode: AutoFixMode = 'simulated',
): Promise<AutoFixSyncIngestResult> {
  const boundedCap = Math.min(100, Math.max(1, Math.trunc(cap)))
  const eligible: ParsedShipment[] = []
  let totalEligible = 0

  for (const shipment of shipments) {
    if (!detectAutoFixCause(shipment.raw_json, inferSourceKind(shipment.sendcloud_id), { latentRules })) continue
    totalEligible += 1
    if (eligible.length < boundedCap) eligible.push(shipment)
  }

  if (eligible.length === 0) {
    return {
      observed: shipments.length,
      eligible: 0,
      resolved: 0,
      detected: 0,
      enqueuedOrSeen: 0,
      truncated: false,
    }
  }

  const idBySendcloudId = await resolveShipmentIds(eligible.map((item) => item.sendcloud_id))
  const sources: CandidateSource[] = eligible.flatMap((shipment) => {
    const shipmentId = idBySendcloudId.get(shipment.sendcloud_id)
    return shipmentId ? [{ shipmentId, shipment }] : []
  })
  const queued = await enqueueAutoFixCandidates(client, tenantId, sources, defaults, latentRules, mode)

  return {
    observed: shipments.length,
    eligible: totalEligible,
    resolved: sources.length,
    detected: queued.detected,
    enqueuedOrSeen: queued.enqueuedOrSeen,
    truncated: totalEligible > eligible.length,
  }
}
