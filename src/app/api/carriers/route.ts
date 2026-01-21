import { NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { getFastTenantId } from '@/lib/supabase/fast-auth'

/**
 * GET /api/carriers - Get distinct carriers from shipments
 * Much more efficient than fetching all shipments
 */
export async function GET() {
  try {
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const supabase = await getServerDb()

    // Get distinct carriers - much more efficient than fetching all shipments
    const { data, error } = await supabase
      .from('shipments')
      .select('carrier')
      .eq('tenant_id', tenantId)
      .not('carrier', 'is', null)
      .order('carrier')

    if (error) throw error

    // Extract unique carriers
    const carriers = [...new Set((data || []).map((s: { carrier: string }) => s.carrier))]

    return NextResponse.json({ carriers }, {
      headers: {
        'Cache-Control': 'private, max-age=600, stale-while-revalidate=3600'
      }
    })
  } catch (error) {
    console.error('Get carriers error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
