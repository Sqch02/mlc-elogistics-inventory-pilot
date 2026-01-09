import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET() {
  try {
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()

    // Get the latest sync run
    const { data: syncRun, error } = await adminClient
      .from('sync_runs')
      .select('id, status, stats_json, error_text, started_at, ended_at')
      .eq('tenant_id', tenantId)
      .eq('source', 'sendcloud')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !syncRun) {
      return NextResponse.json({
        status: 'idle',
        message: 'Aucune synchronisation en cours',
      })
    }

    const stats = syncRun.stats_json as {
      fetched?: number
      created?: number
      updated?: number
      errors?: string[]
      totalExpected?: number
    } | null

    return NextResponse.json({
      id: syncRun.id,
      status: syncRun.status,
      stats: stats || {},
      error: syncRun.error_text,
      startedAt: syncRun.started_at,
      endedAt: syncRun.ended_at,
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}
