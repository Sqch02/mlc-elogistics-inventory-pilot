import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant, requireRole, getCurrentUser } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'

interface InboundRestockEntry {
  status: string
  qty: number
  sku_id: string
  note: string | null
}

// PATCH: Update inbound restock (accept/reject/receive)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const adminClient = createAdminClient()
    const { id } = await params

    const body = await request.json()
    const { action, accepted_qty, note } = body

    // Fetch current entry
    const { data: entryData, error: fetchError } = await adminClient
      .from('inbound_restock')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    const entry = entryData as unknown as InboundRestockEntry | null

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Arrivage non trouve' }, { status: 404 })
    }

    if (action === 'accept') {
      await requireRole(['super_admin', 'admin', 'ops'])

      if (entry.status !== 'pending') {
        return NextResponse.json(
          { error: 'Seuls les arrivages en attente peuvent etre acceptes' },
          { status: 400 }
        )
      }

      const finalQty = accepted_qty != null ? accepted_qty : entry.qty

      // Update the inbound entry
      const { error: updateError } = await adminClient
        .from('inbound_restock')
        .update({
          status: 'accepted',
          accepted_qty: finalQty,
          received: true,
          received_at: new Date().toISOString(),
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
          note: note || entry.note,
        } as never)
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (updateError) throw updateError

      // Le stock passe par apply_stock_delta, comme tout le reste.
      //
      // L'ecriture directe qui se trouvait ici avait trois defauts, tous
      // constates le 25/08 sur un arrivage de 100 flacons :
      //
      //   1. AUCUNE trace. Le registre des mouvements ne recevait rien : le
      //      stock passait de 0 a 100 sans qu'on puisse dire d'ou venait
      //      l'ecart. C'est precisement ce qu'on regarde quand un comptage ne
      //      tombe pas juste.
      //   2. Lecture puis ecriture SANS verrou : une expedition traitee entre
      //      les deux etait perdue.
      //   3. Un arrivage declare sur un LOT creditait le lot lui-meme au lieu
      //      de ses composants. apply_stock_delta decompose.
      const { error: stockError } = await adminClient.rpc('apply_stock_delta', {
        p_tenant_id: tenantId,
        p_sku_id: entry.sku_id,
        p_delta: finalQty,
        p_reason: `Arrivage accepte (${finalQty} unites)`,
        p_reference_id: id,
        p_reference_type: 'inbound_restock',
        p_user_id: user?.id ?? undefined,
        p_movement_type: 'restock',
      })

      if (stockError) throw stockError

      // Sans ce rafraichissement, le stock est bien credite mais la page
      // Produits continue d'afficher l'ancien chiffre jusqu'au passage suivant
      // du cron. C'est ce qui a fait dire "j'ai declare un arrivage et le stock
      // n'apparait pas" — et, pire, ce qui a conduit a saisir un ajustement
      // calcule sur une valeur perimee. Toutes les autres routes qui touchent
      // au stock le font deja ; celle-ci etait la seule a ne pas le faire.
      try {
        await adminClient.rpc('refresh_sku_metrics')
      } catch (refreshError) {
        console.error('[inbound] refresh_sku_metrics failed:', refreshError)
      }

      return NextResponse.json({
        success: true,
        message: `Arrivage accepte: ${finalQty} unites ajoutees au stock`,
      })
    }

    if (action === 'reject') {
      await requireRole(['super_admin', 'admin', 'ops'])

      if (entry.status !== 'pending') {
        return NextResponse.json(
          { error: 'Seuls les arrivages en attente peuvent etre rejetes' },
          { status: 400 }
        )
      }

      const { error: updateError } = await adminClient
        .from('inbound_restock')
        .update({
          status: 'rejected',
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
          note: note || entry.note,
        } as never)
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        message: 'Arrivage rejete',
      })
    }

    return NextResponse.json(
      { error: 'Action non reconnue. Utilisez "accept" ou "reject"' },
      { status: 400 }
    )
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Inbound update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE: Delete a pending inbound entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    await requireRole(['super_admin', 'admin', 'ops'])
    const adminClient = createAdminClient()
    const { id } = await params

    // Only allow deleting pending entries
    const { error } = await adminClient
      .from('inbound_restock')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Inbound delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
