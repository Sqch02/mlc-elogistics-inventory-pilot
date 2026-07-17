import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'

export const dynamic = 'force-dynamic'

// Health de la synchronisation Sendcloud, pour un moniteur externe.
// Retourne toujours HTTP 200 (anti-flapping) avec un booleen `degraded`:
// - degraded=true si aucun tenant n'a eu de sync `success` depuis > 30 min
//   (le cron tourne toutes les 5 min), ou si la DB est injoignable, ou si la
//   sync est en pause manuelle (SYNC_PAUSED).
// Aucun identifiant tenant expose (juste des agregats).
export async function GET() {
  const paused = process.env.SYNC_PAUSED === 'true'
  try {
    const db = getAdminDb()
    const { data, error } = await db
      .from('sync_runs')
      .select('tenant_id, ended_at')
      .eq('source', 'sendcloud')
      .eq('status', 'success')
      .order('ended_at', { ascending: false })
      .limit(500)

    if (error) throw error

    const latestByTenant = new Map<string, number>()
    for (const r of (data ?? []) as Array<{ tenant_id: string; ended_at: string }>) {
      if (!latestByTenant.has(r.tenant_id)) {
        latestByTenant.set(r.tenant_id, new Date(r.ended_at).getTime())
      }
    }

    const now = Date.now()
    let maxStaleMin = 0
    for (const ts of latestByTenant.values()) {
      const mins = (now - ts) / 60000
      if (mins > maxStaleMin) maxStaleMin = mins
    }

    const stale = latestByTenant.size > 0 && maxStaleMin > 30
    const degraded = paused || stale

    return NextResponse.json(
      {
        status: degraded ? 'degraded' : 'ok',
        degraded,
        paused,
        tenants_tracked: latestByTenant.size,
        max_stale_minutes: Math.round(maxStaleMin),
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (e) {
    return NextResponse.json(
      {
        status: 'degraded',
        degraded: true,
        paused,
        db: 'unreachable',
        error: e instanceof Error ? e.message : 'unknown',
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  }
}
