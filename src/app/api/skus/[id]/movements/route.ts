import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
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
  profiles: { full_name?: string; email?: string } | null
}

// GET /api/skus/[id]/movements - Get stock movement history for a SKU
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params

    // Get query params for pagination
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify SKU belongs to tenant
    const { data: sku } = await supabase
      .from('skus')
      .select('id, sku_code, name')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!sku) {
      return NextResponse.json({ error: 'SKU non trouvé' }, { status: 404 })
    }

    // Get movements with user info
    const { data: movements, error, count } = await supabase
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
        created_at,
        profiles:user_id(full_name, email)
      `, { count: 'exact' })
      .eq('sku_id', id)
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
      user: m.profiles ? {
        name: m.profiles.full_name || m.profiles.email || 'Système',
      } : { name: 'Système' },
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
