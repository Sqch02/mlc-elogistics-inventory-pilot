import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

// PATCH /api/locations/[id] - Update a location
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params
    const body = await request.json()

    // Verify location belongs to tenant
    const { data: existing } = await supabase
      .from('locations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Emplacement non trouvé' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.code !== undefined) updateData.code = body.code
    if (body.label !== undefined) updateData.label = body.label
    if (body.active !== undefined) updateData.active = body.active

    const { data: location, error } = await supabase
      .from('locations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Handle SKU assignment
    if (body.sku_code !== undefined) {
      if (body.sku_code) {
        // Find SKU by code FIRST before making any changes
        const { data: sku } = await supabase
          .from('skus')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('sku_code', body.sku_code)
          .single()

        if (!sku) {
          return NextResponse.json(
            { error: `SKU non trouvé: ${body.sku_code}` },
            { status: 404 }
          )
        }

        // Remove existing assignment
        await supabase
          .from('location_assignments')
          .delete()
          .eq('location_id', id)

        // Create new assignment
        await supabase.from('location_assignments').insert({
          tenant_id: tenantId,
          location_id: id,
          sku_id: sku.id,
        })
      } else {
        // Just remove existing assignment (unassign)
        await supabase
          .from('location_assignments')
          .delete()
          .eq('location_id', id)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Emplacement mis à jour',
      location
    })
  } catch (error) {
    console.error('Error updating location:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE /api/locations/[id] - Delete a location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params

    // Verify location belongs to tenant
    const { data: existing } = await supabase
      .from('locations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Emplacement non trouvé' }, { status: 404 })
    }

    // Delete assignment first
    await supabase
      .from('location_assignments')
      .delete()
      .eq('location_id', id)

    // Delete the location
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Emplacement supprimé'
    })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
