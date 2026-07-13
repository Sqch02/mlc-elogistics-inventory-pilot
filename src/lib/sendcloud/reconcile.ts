import type { getAdminDb } from '@/lib/supabase/untyped'
import { fetchParcelsByOrderNumber } from '@/lib/sendcloud/client'
import type { SendcloudCredentials, ParsedShipment } from '@/lib/sendcloud/types'
import { createSyncCorrelationId, createSyncLogger } from '@/lib/sendcloud/sync-logger'

// ============================================================================
// RECONCILIATION - stuck "On Hold" orders (Mondial Relay status bug)
// ============================================================================
// Certain orders (mostly Mondial Relay) get stuck as "On Hold" integration rows
// (UUID sendcloud_id, status_id NULL) in our DB even after the carrier delivered
// them. Cause: Mondial Relay status updates sometimes "drop", the order stays in
// announcement state, Quentin flips it to "Delivered" MANUALLY in Sendcloud -
// but that flip lives on the *order* (not on a fetched *parcel*), so the
// incremental cron never sees it and the row stays "On Hold" forever. Being "On
// Hold" it is EXCLUDED from "unites vendues", i.e. a real delivery is uncounted.
//
// reconcileTenant re-checks such stuck orders against Sendcloud's REAL parcel
// status (queried by order_number) and updates the row's status in place.
//
// SAFE BY DESIGN:
//  - only On Hold UUID rows with NO numeric sibling (a sibling means the real
//    parcel is already tracked elsewhere -> updating would double-count); the
//    reconcile_stuck_candidates RPC enforces this in SQL,
//  - only rows older than 24h (leave genuinely-fresh pending orders alone),
//  - updates STATUS / tracking / shipped_at only, NEVER touches stock,
//  - stamps reconcile_checked_at so parcel-less orders aren't re-probed for 3d,
//  - dryRun=true reports what would change without writing.
//
// It does NOT refresh analytics views - the caller decides (the endpoint
// refreshes when it wrote changes; the cron already refreshes at the end).

export interface ReconcileResult {
  tenantId: string
  scanned: number
  updated: number
  noParcelFound: number
  errors: number
  changed: boolean
  samples: Array<{ order_ref: string; to: string | null; statusId: number | null }>
}

interface StuckRow {
  id: string
  order_ref: string
  sendcloud_id: string
}

// Among the parcels returned for an order_number, pick the most authoritative
// outbound one: a Delivered parcel (status 11) wins, otherwise the most recently
// updated parcel that carries a real tracking status.
function pickBestParcel(parcels: ParsedShipment[]): ParsedShipment | null {
  const candidates = parcels.filter((p) => !p.is_return && p.status_id != null)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const aDelivered = a.status_id === 11 ? 1 : 0
    const bDelivered = b.status_id === 11 ? 1 : 0
    if (aDelivered !== bDelivered) return bDelivered - aDelivered
    return (b.date_updated || '').localeCompare(a.date_updated || '')
  })
  return candidates[0]
}

export async function reconcileTenant(
  adminClient: ReturnType<typeof getAdminDb>,
  tenantId: string,
  credentials: SendcloudCredentials,
  limit: number,
  dryRun: boolean,
  correlationId = createSyncCorrelationId(),
): Promise<ReconcileResult> {
  const logger = createSyncLogger('Reconcile', correlationId)
  const res: ReconcileResult = {
    tenantId,
    scanned: 0,
    updated: 0,
    noParcelFound: 0,
    errors: 0,
    changed: false,
    samples: [],
  }

  // Genuine stuck orders only: On Hold UUID rows with NO numeric sibling, older
  // than 24h. The RPC does the NOT EXISTS + "not checked in the last 3d" in SQL
  // so we never churn on the thousands of already-tracked duplicates.
  const { data: candidates } = await adminClient.rpc('reconcile_stuck_candidates', {
    p_tenant_id: tenantId,
    p_limit: limit,
  })
  const toProcess = (candidates || []) as StuckRow[]
  res.scanned = toProcess.length
  if (toProcess.length === 0) return res

  for (const row of toProcess) {
    try {
      const parcels = await fetchParcelsByOrderNumber(credentials, row.order_ref)
      const best = pickBestParcel(parcels)
      if (!best) {
        res.noParcelFound++
        // Stamp it so we don't re-probe this parcel-less order every run
        // (old abandoned On Hold orders that were never actually shipped).
        if (!dryRun) {
          await adminClient
            .from('shipments')
            .update({ reconcile_checked_at: new Date().toISOString() })
            .eq('id', row.id)
        }
        continue
      }

      if (res.samples.length < 25) {
        res.samples.push({
          order_ref: row.order_ref,
          to: best.status_message,
          statusId: best.status_id,
        })
      }

      if (!dryRun) {
        const { error } = await adminClient
          .from('shipments')
          .update({
            status_id: best.status_id,
            status_message: best.status_message,
            tracking: best.tracking,
            tracking_url: best.tracking_url,
            shipped_at: best.shipped_at,
            has_error: best.has_error,
            error_message: best.error_message,
            reconcile_checked_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        if (error) {
          logger.error(`Update error for ${row.order_ref}:`, error.message)
          res.errors++
          continue
        }
        res.changed = true
      }
      res.updated++
    } catch (err) {
      logger.error(`Sendcloud fetch error for ${row.order_ref}:`, err)
      res.errors++
    }
  }

  return res
}
