import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant, getCurrentUser, requireRole } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'

// PATCH /api/skus/[id]/stock - Adjust stock quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Stock adjustment is an ops action: block the low-privilege 'client' role
    // (API routes are excluded from the middleware, so this is the only guard).
    await requireRole(['super_admin', 'admin', 'ops'])
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const supabase = await getServerDb()
    const { id } = await params
    const body = await request.json()

    const { qty_current, adjustment, expected_qty, reason, movement_type } = body

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
      // Un ajustement RELATIF n'a de sens que rapporte a la valeur sur
      // laquelle l'operateur l'a calcule.
      //
      // Le 25/08, un arrivage de 100 flacons a ete accepte pendant qu'une page
      // Produits ouverte affichait encore 0. L'operateur a saisi +99 en voyant
      // l'apercu annoncer "Nouveau stock: 99" — ce qu'il voulait. Le serveur a
      // applique ces 99 au stock reel, deja passe a 100 : 199 au lieu de 99.
      // Cent unites d'ecart, sans le moindre message.
      //
      // L'appelant declare donc ce qu'il croyait etre le stock. Si la valeur a
      // bouge entre-temps, on REFUSE plutot que d'appliquer un calcul dont on
      // sait qu'il repose sur autre chose que la realite.
      if (expected_qty === undefined || expected_qty === null) {
        return NextResponse.json(
          { error: 'expected_qty requis avec adjustment : un ajustement relatif doit dire sur quelle valeur il a ete calcule' },
          { status: 400 }
        )
      }

      const liveQty = currentStock?.qty_current || 0
      if (liveQty !== expected_qty) {
        return NextResponse.json(
          {
            error: 'Le stock a change pendant votre saisie',
            detail: `Vous avez calcule cet ajustement sur ${expected_qty} unites, le stock est maintenant a ${liveQty}. Rechargez la page et refaites l'ajustement.`,
            expected_qty,
            current_qty: liveQty,
          },
          { status: 409 }
        )
      }

      newQty = liveQty + adjustment
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

    const previousQty = currentStock?.qty_current || 0
    const adjustmentAmount = newQty - previousQty

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

    // Log the movement to stock_movements table
    await supabase
      .from('stock_movements')
      .insert({
        tenant_id: tenantId,
        sku_id: id,
        qty_before: previousQty,
        qty_after: newQty,
        adjustment: adjustmentAmount,
        movement_type: movement_type || 'manual',
        reason: reason || null,
        user_id: user?.id || null,
      })

    console.log(`[Stock] SKU ${sku.sku_code}: ${previousQty} → ${newQty} (${reason || 'manual adjustment'})`)

    // Refresh mv_sku_metrics so the new value shows up immediately on the
    // Produits & Stock + Dashboard pages (otherwise it stayed stuck at the
    // previous snapshot until the next cron tick).
    try {
      await supabase.rpc('refresh_sku_metrics')
    } catch (refreshError) {
      console.error('[Stock] refresh_sku_metrics failed:', refreshError)
    }

    return NextResponse.json({
      success: true,
      message: 'Stock mis à jour',
      previous_qty: previousQty,
      new_qty: newQty,
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Error adjusting stock:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
