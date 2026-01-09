import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

// PATCH /api/skus/[id]/stock - Adjust stock quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params
    const body = await request.json()

    const { qty_current, adjustment, reason } = body

    // Verify SKU belongs to tenant
    const { data: sku } = await supabase
      .from('skus')
      .select('id, sku_code')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single()

    if (!sku) {
      return NextResponse.json({ error: 'SKU non trouvé' }, { status: 404 })
    }

    // Get current stock
    const { data: currentStock } = await supabase
      .from('stock_snapshots')
      .select('qty_current')
      .eq('sku_id', id)
      .single()

    let newQty: number

    if (qty_current !== undefined) {
      // Absolute value set
      newQty = qty_current
    } else if (adjustment !== undefined) {
      // Relative adjustment (+/-)
      newQty = (currentStock?.qty_current || 0) + adjustment
    } else {
      return NextResponse.json(
        { error: 'qty_current ou adjustment requis' },
        { status: 400 }
      )
    }

    if (newQty < 0) {
      return NextResponse.json(
        { error: 'Le stock ne peut pas être négatif' },
        { status: 400 }
      )
    }

    // Update or insert stock snapshot
    const { error } = await supabase
      .from('stock_snapshots')
      .upsert({
        tenant_id: tenantId,
        sku_id: id,
        qty_current: newQty,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'sku_id'
      })

    if (error) throw error

    // Log the adjustment (optional - could create a stock_movements table)
    console.log(`[Stock] SKU ${sku.sku_code}: ${currentStock?.qty_current || 0} → ${newQty} (${reason || 'manual adjustment'})`)

    return NextResponse.json({
      success: true,
      message: 'Stock mis à jour',
      previous_qty: currentStock?.qty_current || 0,
      new_qty: newQty,
    })
  } catch (error) {
    console.error('Error adjusting stock:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
