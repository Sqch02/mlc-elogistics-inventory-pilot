import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireRole } from '@/lib/supabase/auth'
import { getFastTenantId } from '@/lib/supabase/fast-auth'

// GET: List all mappings for tenant + unmapped descriptions
export async function GET() {
  try {
    await requireRole(['super_admin', 'admin'])
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant non trouve' }, { status: 400 })
    }

    const db = getAdminDb()

    const { data: mappings } = await db
      .from('sendcloud_sku_mappings')
      .select('id, description_pattern, sku_id, created_at, skus(sku_code, name)')
      .eq('tenant_id', tenantId)
      .order('description_pattern')

    // Get unmapped descriptions from shipments
    const { data: unmapped } = await db
      .from('shipments')
      .select('unmapped_items')
      .eq('tenant_id', tenantId)
      .not('unmapped_items', 'is', null)

    // Aggregate unique unmapped descriptions
    const unmappedDescs = new Map<string, number>()
    for (const s of unmapped || []) {
      for (const item of s.unmapped_items || []) {
        const key = item.description
        if (key) {
          unmappedDescs.set(key, (unmappedDescs.get(key) || 0) + (item.qty || 1))
        }
      }
    }

    return NextResponse.json({
      mappings: mappings || [],
      unmapped: Array.from(unmappedDescs.entries()).map(([desc, qty]) => ({
        description: desc,
        total_qty: qty,
      })).sort((a, b) => b.total_qty - a.total_qty),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST: Create a new mapping
export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin'])
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant non trouve' }, { status: 400 })
    }

    const db = getAdminDb()
    const body = await request.json()

    const { description_pattern, sku_id } = body

    if (!description_pattern || !sku_id) {
      return NextResponse.json(
        { error: 'description_pattern et sku_id requis' },
        { status: 400 }
      )
    }

    const { data, error } = await db
      .from('sendcloud_sku_mappings')
      .insert({
        tenant_id: tenantId,
        description_pattern,
        sku_id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ce mapping existe deja' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ mapping: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a mapping
export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin'])
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant non trouve' }, { status: 400 })
    }

    const db = getAdminDb()
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    await db
      .from('sendcloud_sku_mappings')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
