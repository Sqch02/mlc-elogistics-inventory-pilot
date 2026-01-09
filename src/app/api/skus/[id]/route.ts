import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

// GET /api/skus/[id] - Get a single SKU
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params

    const { data: sku, error } = await supabase
      .from('skus')
      .select(`
        id,
        sku_code,
        name,
        description,
        weight_grams,
        alert_threshold,
        created_at,
        stock_snapshots(qty_current, updated_at),
        location_assignments(
          locations(code, label)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'SKU non trouvé' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ sku })
  } catch (error) {
    console.error('Error fetching SKU:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// PATCH /api/skus/[id] - Update a SKU
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params
    const body = await request.json()

    const { sku_code, name, description, weight_grams, alert_threshold } = body

    // Verify SKU belongs to tenant
    const { data: existing } = await supabase
      .from('skus')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'SKU non trouvé' }, { status: 404 })
    }

    // Check for duplicate sku_code if changing it
    if (sku_code) {
      const { data: duplicate } = await supabase
        .from('skus')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('sku_code', sku_code)
        .neq('id', id)
        .single()

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ce code SKU existe déjà' },
          { status: 409 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (sku_code !== undefined) updateData.sku_code = sku_code
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (weight_grams !== undefined) updateData.weight_grams = weight_grams
    if (alert_threshold !== undefined) updateData.alert_threshold = alert_threshold

    const { data: sku, error } = await supabase
      .from('skus')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'SKU mis à jour',
      sku
    })
  } catch (error) {
    console.error('Error updating SKU:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE /api/skus/[id] - Delete a SKU
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params

    // Check if SKU has shipment_items (can't delete if used)
    const { count: itemCount } = await supabase
      .from('shipment_items')
      .select('*', { count: 'exact', head: true })
      .eq('sku_id', id)

    if (itemCount && itemCount > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer: ce SKU a des expéditions associées' },
        { status: 409 }
      )
    }

    // Delete related records first
    await supabase.from('stock_snapshots').delete().eq('sku_id', id)
    await supabase.from('location_assignments').delete().eq('sku_id', id)
    await supabase.from('bundle_components').delete().eq('component_sku_id', id)

    // Delete the SKU
    const { error } = await supabase
      .from('skus')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'SKU supprimé'
    })
  } catch (error) {
    console.error('Error deleting SKU:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
