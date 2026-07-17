import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { reconcileTenant, type ReconcileResult } from '@/lib/sendcloud/reconcile'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'
import { createSyncCorrelationId, createSyncLogger } from '@/lib/sendcloud/sync-logger'
import { safeEqual } from '@/lib/utils/safe-compare'

// On-demand trigger for the stuck-"On Hold" reconciliation (see the logic and
// safety notes in src/lib/sendcloud/reconcile.ts). The same routine also runs
// automatically at the tail of the 5-min cron.
//
// GET /api/sync/sendcloud/reconcile?dry_run=false&limit=100[&tenant=<id>]
// Auth: Authorization: Bearer <CRON_SECRET>. dry_run defaults to TRUE (safe).

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const correlationId = createSyncCorrelationId()
  const logger = createSyncLogger('Reconcile', correlationId)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
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
      const res = await reconcileTenant(
        adminClient,
        tenant.id,
        credentials,
        limit,
        dryRun,
        correlationId,
      )
      if (res.changed) anyChange = true
      results.push(res)
    } catch (err) {
      logger.error(`Tenant ${tenant.id} failed:`, err)
      results.push({
        tenantId: tenant.id,
        scanned: 0,
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
      logger.error('View refresh failed:', e)
    }
  }

  return NextResponse.json({
    success: true,
    correlationId,
    dryRun,
    limit,
    timestamp: new Date().toISOString(),
    results,
  })
}
