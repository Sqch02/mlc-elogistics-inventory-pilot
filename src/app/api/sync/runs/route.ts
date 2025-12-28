import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')
    const source = searchParams.get('source') || 'sendcloud'

    const { data: runs, error } = await supabase
      .from('sync_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('source', source)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return NextResponse.json({ runs })
  } catch (error) {
    console.error('Get sync runs error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
