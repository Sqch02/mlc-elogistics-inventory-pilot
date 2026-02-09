import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant, requireRole, getCurrentUser } from '@/lib/supabase/auth'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry, error: fetchError } = await adminClient
      .from('inbound_restock')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single() as any

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

      // Update stock_snapshots
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: snapshot } = await adminClient
        .from('stock_snapshots')
        .select('id, qty_current')
        .eq('sku_id', entry.sku_id)
        .eq('tenant_id', tenantId)
        .single() as any

      if (snapshot) {
        await adminClient
          .from('stock_snapshots')
          .update({
            qty_current: (snapshot.qty_current || 0) + finalQty,
          } as never)
          .eq('id', snapshot.id)
      } else {
        await adminClient
          .from('stock_snapshots')
          .insert({
            tenant_id: tenantId,
            sku_id: entry.sku_id,
            qty_current: finalQty,
            qty_initial: finalQty,
          } as never)
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
    console.error('Inbound delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
