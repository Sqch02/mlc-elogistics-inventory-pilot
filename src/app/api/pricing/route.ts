import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'
import { auditCreate } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '500', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: rules, error, count } = await supabase
      .from('pricing_rules')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('carrier')
      .order('destination')
      .order('weight_min_grams')
      .range(from, to)

    if (error) {
      throw error
    }

    return NextResponse.json({
      rules: rules || [],
      total: count ?? (rules?.length || 0),
      page,
      limit,
    })
  } catch (error) {
    console.error('Get pricing rules error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const supabase = await getServerDb()
    const body = await request.json()

    const { data: rule, error } = await supabase
      .from('pricing_rules')
      .insert({
        tenant_id: tenantId,
        carrier: body.carrier,
        destination: body.destination || null,
        weight_min_grams: body.weight_min_grams,
        weight_max_grams: body.weight_max_grams,
        price_eur: body.price_eur,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Audit log
    await auditCreate(
      tenantId,
      user?.id || null,
      'pricing_rule',
      rule.id,
      rule,
      request.headers
    )

    return NextResponse.json({ success: true, rule })
  } catch (error) {
    console.error('Create pricing rule error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
