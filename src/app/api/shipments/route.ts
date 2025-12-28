import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user and profile
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    const tenantId = profile?.tenant_id || '00000000-0000-0000-0000-000000000001'

    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const carrier = searchParams.get('carrier')
    const pricingStatus = searchParams.get('pricing_status')

    let query = supabase
      .from('shipments')
      .select(`
        *,
        shipment_items(
          qty,
          skus(sku_code, name)
        )
      `)
      .eq('tenant_id', tenantId)
      .order('shipped_at', { ascending: false })

    if (from) {
      query = query.gte('shipped_at', from)
    }

    if (to) {
      query = query.lte('shipped_at', to)
    }

    if (carrier) {
      query = query.ilike('carrier', carrier)
    }

    if (pricingStatus) {
      query = query.eq('pricing_status', pricingStatus)
    }

    const { data: shipments, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ shipments })
  } catch (error) {
    console.error('Get shipments error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
