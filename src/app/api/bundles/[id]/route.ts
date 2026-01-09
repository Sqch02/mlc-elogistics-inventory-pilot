import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

// DELETE /api/bundles/[id] - Delete a bundle
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params

    // Verify bundle belongs to tenant
    const { data: bundle } = await supabase
      .from('bundles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle non trouvé' }, { status: 404 })
    }

    // Delete components first
    await supabase
      .from('bundle_components')
      .delete()
      .eq('bundle_id', id)

    // Delete the bundle
    const { error } = await supabase
      .from('bundles')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Bundle supprimé'
    })
  } catch (error) {
    console.error('Error deleting bundle:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// PATCH /api/bundles/[id] - Update bundle components
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params
    const body = await request.json()

    const { components } = body

    // Verify bundle belongs to tenant
    const { data: bundle } = await supabase
      .from('bundles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle non trouvé' }, { status: 404 })
    }

    if (components && Array.isArray(components)) {
      // Delete existing components
      await supabase
        .from('bundle_components')
        .delete()
        .eq('bundle_id', id)

      // Add new components
      for (const comp of components) {
        const { data: componentSku } = await supabase
          .from('skus')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('sku_code', comp.sku_code)
          .single()

        if (!componentSku) {
          console.warn(`Component SKU not found: ${comp.sku_code}`)
          continue
        }

        await supabase.from('bundle_components').insert({
          tenant_id: tenantId,
          bundle_id: id,
          component_sku_id: componentSku.id,
          qty_component: comp.qty || 1,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bundle mis à jour'
    })
  } catch (error) {
    console.error('Error updating bundle:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
