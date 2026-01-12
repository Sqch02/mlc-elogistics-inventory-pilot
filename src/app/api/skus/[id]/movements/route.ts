import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

interface MovementRow {
  id: string
  qty_before: number
  qty_after: number
  adjustment: number
  movement_type: string
  reason: string | null
  reference_id: string | null
  reference_type: string | null
  user_id: string | null
  created_at: string
}

// GET /api/skus/[id]/movements - Get stock movement history for a SKU
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()
    const { id } = await params

    // Get query params for pagination
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify SKU belongs to tenant
    const { data: sku } = await adminClient
      .from('skus')
      .select('id, sku_code, name')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!sku) {
      return NextResponse.json({ error: 'SKU non trouvé' }, { status: 404 })
    }

    // Get movements (without user join to avoid RLS recursion on profiles)
    const { data: movements, error, count } = await adminClient
      .from('stock_movements')
      .select(`
        id,
        qty_before,
        qty_after,
        adjustment,
        movement_type,
        reason,
        reference_id,
        reference_type,
        user_id,
        created_at
      `, { count: 'exact' })
      .eq('sku_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Format movements for response
    const formattedMovements = (movements as MovementRow[] | null)?.map((m) => ({
      id: m.id,
      qty_before: m.qty_before,
      qty_after: m.qty_after,
      adjustment: m.adjustment,
      movement_type: m.movement_type,
      reason: m.reason,
      reference_id: m.reference_id,
      reference_type: m.reference_type,
      created_at: m.created_at,
      user: { name: 'Système' },
    }))

    return NextResponse.json({
      sku: {
        id: sku.id,
        sku_code: sku.sku_code,
        name: sku.name,
      },
      movements: formattedMovements || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching stock movements:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
