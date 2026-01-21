import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'
import { auditUpdate, auditDelete } from '@/lib/audit'

// PATCH /api/pricing/[id] - Update a pricing rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const supabase = await getServerDb()
    const { id } = await params
    const body = await request.json()

    // Get current rule for audit log
    const { data: existing } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Règle non trouvée' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.carrier !== undefined) updateData.carrier = body.carrier
    if (body.destination !== undefined) updateData.destination = body.destination
    if (body.weight_min_grams !== undefined) updateData.weight_min_grams = body.weight_min_grams
    if (body.weight_max_grams !== undefined) updateData.weight_max_grams = body.weight_max_grams
    if (body.price_eur !== undefined) updateData.price_eur = body.price_eur

    const { data: rule, error } = await supabase
      .from('pricing_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Audit log
    await auditUpdate(
      tenantId,
      user?.id || null,
      'pricing_rule',
      id,
      existing,
      rule,
      request.headers
    )

    return NextResponse.json({
      success: true,
      message: 'Règle mise à jour',
      rule
    })
  } catch (error) {
    console.error('Error updating pricing rule:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE /api/pricing/[id] - Delete a pricing rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const supabase = await getServerDb()
    const { id } = await params

    // Get current rule for audit log
    const { data: existing } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Règle non trouvée' }, { status: 404 })
    }

    const { error } = await supabase
      .from('pricing_rules')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error

    // Audit log
    await auditDelete(
      tenantId,
      user?.id || null,
      'pricing_rule',
      id,
      existing,
      request.headers
    )

    return NextResponse.json({
      success: true,
      message: 'Règle supprimée'
    })
  } catch (error) {
    console.error('Error deleting pricing rule:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
