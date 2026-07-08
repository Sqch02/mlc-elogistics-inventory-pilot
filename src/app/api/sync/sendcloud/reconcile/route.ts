import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { fetchParcelsByOrderNumber } from '@/lib/sendcloud/client'
import type { SendcloudCredentials, ParsedShipment } from '@/lib/sendcloud/types'

// ============================================================================
// RECONCILIATION - stuck "On Hold" orders (Mondial Relay status bug)
// ============================================================================
// Certain orders (mostly Mondial Relay) get stuck as "On Hold" integration
// rows (UUID sendcloud_id, status_id NULL) in our DB even after the carrier
// delivered them. Cause: Mondial Relay status updates sometimes "drop", the
// order stays in announcement state, Quentin flips it to "Delivered" MANUALLY
// in Sendcloud - but that manual flip lives on the *order* (not on a fetched
// *parcel*), so our incremental cron never sees it and the row stays "On Hold"
// forever. Being "On Hold" it is then EXCLUDED from "unites vendues", i.e. a
// real delivery is silently uncounted.
//
// This endpoint re-checks such stuck orders against Sendcloud's REAL parcel
// status (queried by order_number) and updates the row's status in place.
//
// SAFE BY DESIGN:
//  - only On Hold UUID rows that have NO numeric sibling (a sibling means the
//    real parcel is already tracked elsewhere -> updating would double-count),
//  - only rows older than 24h (leave genuinely-fresh pending orders alone),
//  - updates STATUS/tracking/shipped_at only, NEVER touches stock,
//  - dry_run=true (the default) reports what would change without writing.
//
// Trigger: GET /api/sync/sendcloud/reconcile?dry_run=false&limit=100[&tenant=<id>]
// Auth: Authorization: Bearer <CRON_SECRET> (same as the cron).

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface StuckRow {
  id: string
  order_ref: string
  sendcloud_id: string
}

interface ReconcileResult {
  tenantId: string
  scanned: number
  skippedHasSibling: number
  updated: number
  noParcelFound: number
  errors: number
  changed: boolean
  samples: Array<{ order_ref: string; to: string | null; statusId: number | null }>
}

// Among the parcels returned for an order_number, pick the most authoritative
// outbound one: a Delivered parcel (status 11) wins, otherwise the most
// recently updated parcel that carries a real tracking status.
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

async function reconcileTenant(
  adminClient: ReturnType<typeof getAdminDb>,
  tenantId: string,
  credentials: SendcloudCredentials,
  limit: number,
  dryRun: boolean,
): Promise<ReconcileResult> {
  const res: ReconcileResult = {
    tenantId,
    scanned: 0,
    skippedHasSibling: 0,
    updated: 0,
    noParcelFound: 0,
    errors: 0,
    changed: false,
    samples: [],
  }

  // 1. Genuine stuck orders only: On Hold UUID rows with NO numeric sibling,
  // older than 24h. The RPC does the NOT EXISTS in SQL so we never churn on the
  // thousands of already-tracked duplicates (which would otherwise fill every
  // batch and starve the real backlog).
  const { data: candidates } = await adminClient.rpc('reconcile_stuck_candidates', {
    p_tenant_id: tenantId,
    p_limit: limit,
  })
  const toProcess = (candidates || []) as StuckRow[]
  res.scanned = toProcess.length
  if (toProcess.length === 0) return res

  // 2. For each stuck order, ask Sendcloud for its real parcel status.
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
          console.error(`[Reconcile] Update error for ${row.order_ref}:`, error.message)
          res.errors++
          continue
        }
        res.changed = true
      }
      res.updated++
    } catch (err) {
      console.error(`[Reconcile] Sendcloud fetch error for ${row.order_ref}:`, err)
      res.errors++
    }
  }

  return res
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dry_run') !== 'false' // default TRUE (safe)
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50))
  const tenantFilter = url.searchParams.get('tenant')

  const adminClient = getAdminDb()

  let tenantQuery = adminClient.from('tenants').select('id')
  if (tenantFilter) tenantQuery = tenantQuery.eq('id', tenantFilter)
  const { data: tenants, error: tenantsError } = await tenantQuery
  if (tenantsError || !tenants) {
    return NextResponse.json({ error: 'Failed to load tenants' }, { status: 500 })
  }

  const results: ReconcileResult[] = []
  let anyChange = false

  for (const tenant of tenants as Array<{ id: string }>) {
    const { data: settings } = await adminClient
      .from('tenant_settings')
      .select('sendcloud_api_key, sendcloud_secret')
      .eq('tenant_id', tenant.id)
      .single()

    if (!settings?.sendcloud_api_key || !settings?.sendcloud_secret) continue

    const credentials: SendcloudCredentials = {
      apiKey: settings.sendcloud_api_key,
      secret: settings.sendcloud_secret,
    }

    try {
      const res = await reconcileTenant(adminClient, tenant.id, credentials, limit, dryRun)
      if (res.changed) anyChange = true
      results.push(res)
    } catch (err) {
      console.error(`[Reconcile] Tenant ${tenant.id} failed:`, err)
      results.push({
        tenantId: tenant.id,
        scanned: 0,
        skippedHasSibling: 0,
        updated: 0,
        noParcelFound: 0,
        errors: 1,
        changed: false,
        samples: [],
      })
    }
  }

  // Only refresh analytics views when we actually wrote status changes, so a
  // dry-run stays read-only and cheap.
  if (anyChange) {
    try {
      await adminClient.rpc('refresh_physical_items_view')
      await adminClient.rpc('refresh_sku_metrics')
    } catch (e) {
      console.error('[Reconcile] View refresh failed:', e)
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    limit,
    timestamp: new Date().toISOString(),
    results,
  })
}
