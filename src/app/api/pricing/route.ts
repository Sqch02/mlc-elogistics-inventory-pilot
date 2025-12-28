import { NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET() {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const { data: rules, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('carrier')
      .order('weight_min_grams')

    if (error) {
      throw error
    }

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('Get pricing rules error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const body = await request.json()

    const { data: rule, error } = await supabase
      .from('pricing_rules')
      .insert({
        tenant_id: tenantId,
        carrier: body.carrier,
        weight_min_grams: body.weight_min_grams,
        weight_max_grams: body.weight_max_grams,
        price_eur: body.price_eur,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, rule })
  } catch (error) {
    console.error('Create pricing rule error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
