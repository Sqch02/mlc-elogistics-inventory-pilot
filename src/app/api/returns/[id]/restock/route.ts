import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant, requireRole, getCurrentUser } from '@/lib/supabase/auth'

// POST: Validate or reject restock for a return
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    await requireRole(['super_admin', 'admin', 'ops'])
    const user = await getCurrentUser()
    const adminClient = createAdminClient()
    const { id } = await params

    const body = await request.json()
    const { action, restock_qty, note } = body

    if (!action || !['validate', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action invalide. Utilisez "validate" ou "reject"' },
        { status: 400 }
      )
    }

    // Fetch the return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: returnEntry, error: fetchError } = await adminClient
      .from('returns')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single() as any

    if (fetchError || !returnEntry) {
      return NextResponse.json({ error: 'Retour non trouvé' }, { status: 404 })
    }

    if (returnEntry.restock_status === 'validated') {
      return NextResponse.json(
        { error: 'Ce retour a déjà été validé pour remise en stock' },
        { status: 400 }
      )
    }

    if (returnEntry.restock_status === 'rejected') {
      return NextResponse.json(
        { error: 'Ce retour a déjà été rejeté pour remise en stock' },
        { status: 400 }
      )
    }

    if (action === 'validate') {
      const qty = restock_qty || 1

      if (qty <= 0) {
        return NextResponse.json(
          { error: 'La quantité doit être supérieure à 0' },
          { status: 400 }
        )
      }

      // Find the SKU linked to this return via the original shipment's items
      let skuId: string | null = null
      let skuCode: string | null = null

      if (returnEntry.original_shipment_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: items } = await adminClient
          .from('shipment_items')
          .select('sku_id, quantity, skus(sku_code)')
          .eq('shipment_id', returnEntry.original_shipment_id)
          .limit(1) as any

        if (items && items.length > 0) {
          skuId = items[0].sku_id
          skuCode = items[0].skus?.sku_code || null
        }
      }

      // If no shipment link, try to find via order_ref
      if (!skuId && returnEntry.order_ref) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: shipment } = await adminClient
          .from('shipments')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('order_ref', returnEntry.order_ref)
          .eq('is_return', false)
          .limit(1)
          .single() as any

        if (shipment) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: items } = await adminClient
            .from('shipment_items')
            .select('sku_id, quantity, skus(sku_code)')
            .eq('shipment_id', shipment.id)
            .limit(1) as any

          if (items && items.length > 0) {
            skuId = items[0].sku_id
            skuCode = items[0].skus?.sku_code || null
          }
        }
      }

      // Update the return status
      const { error: updateError } = await adminClient
        .from('returns')
        .update({
          restock_status: 'validated',
          restock_qty: qty,
          restock_note: note || null,
          restocked_by: user?.id || null,
          restocked_at: new Date().toISOString(),
        } as never)
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (updateError) throw updateError

      // If we found the SKU, update stock
      if (skuId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: snapshot } = await adminClient
          .from('stock_snapshots')
          .select('id, qty_current')
          .eq('sku_id', skuId)
          .eq('tenant_id', tenantId)
          .single() as any

        const qtyBefore = snapshot?.qty_current || 0
        const qtyAfter = qtyBefore + qty

        if (snapshot) {
          await adminClient
            .from('stock_snapshots')
            .update({ qty_current: qtyAfter } as never)
            .eq('id', snapshot.id)
        } else {
          await adminClient
            .from('stock_snapshots')
            .insert({
              tenant_id: tenantId,
              sku_id: skuId,
              qty_current: qty,
              qty_initial: qty,
            } as never)
        }

        // Record stock movement
        await adminClient
          .from('stock_movements')
          .insert({
            tenant_id: tenantId,
            sku_id: skuId,
            qty_before: qtyBefore,
            qty_after: qtyAfter,
            adjustment: qty,
            movement_type: 'return_restock',
            reason: `Retour client validé${skuCode ? ` (${skuCode})` : ''} - ${note || 'Remise en stock'}`,
            reference_id: id,
            reference_type: 'return',
          } as never)

        return NextResponse.json({
          success: true,
          message: `Remise en stock validée : +${qty} unités pour ${skuCode || 'SKU inconnu'}`,
          sku_id: skuId,
          sku_code: skuCode,
          qty_added: qty,
        })
      }

      // No SKU found - still mark as validated but warn
      return NextResponse.json({
        success: true,
        message: 'Retour validé mais aucun SKU trouvé pour mise à jour du stock. Veuillez ajuster manuellement.',
        warning: 'no_sku_found',
      })
    }

    if (action === 'reject') {
      const { error: updateError } = await adminClient
        .from('returns')
        .update({
          restock_status: 'rejected',
          restock_note: note || null,
          restocked_by: user?.id || null,
          restocked_at: new Date().toISOString(),
        } as never)
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        message: 'Remise en stock rejetée',
      })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error) {
    console.error('Return restock error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
