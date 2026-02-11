import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'

// GET: List inbound restock entries
export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const adminClient = createAdminClient()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let query = adminClient
      .from('inbound_restock')
      .select('*, skus(id, sku_code, name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`note.ilike.%${search}%,supplier.ilike.%${search}%,batch_reference.ilike.%${search}%`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await query as any

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Inbound list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST: Create inbound restock entries (supports multiple items per arrivage)
export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const adminClient = createAdminClient()

    const body = await request.json()

    // Support both formats: {items: [...], eta_date, ...} or legacy {sku_id, qty, eta_date, ...}
    const items: { sku_id: string; qty: number }[] = body.items
      ? body.items
      : [{ sku_id: body.sku_id, qty: body.qty }]

    const eta_date = body.eta_date
    const note = body.note || null
    const supplier = body.supplier || null
    const batch_reference = body.batch_reference || null

    if (!eta_date || items.length === 0) {
      return NextResponse.json(
        { error: 'eta_date et au moins un produit sont requis' },
        { status: 400 }
      )
    }

    // Validate all items
    for (const item of items) {
      if (!item.sku_id || !item.qty || item.qty <= 0) {
        return NextResponse.json(
          { error: 'Chaque produit doit avoir un SKU et une quantite > 0' },
          { status: 400 }
        )
      }
    }

    // Verify all SKUs belong to tenant
    const skuIds = [...new Set(items.map(i => i.sku_id))]
    const { data: skus } = await adminClient
      .from('skus')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('id', skuIds)

    if (!skus || skus.length !== skuIds.length) {
      return NextResponse.json(
        { error: 'Un ou plusieurs SKUs non trouves' },
        { status: 404 }
      )
    }

    // Insert one row per item with shared fields
    const rows = items.map(item => ({
      tenant_id: tenantId,
      sku_id: item.sku_id,
      qty: item.qty,
      eta_date,
      note,
      supplier,
      batch_reference,
      status: 'pending',
      received: false,
      created_by: user?.id || null,
    }))

    const { data, error } = await adminClient
      .from('inbound_restock')
      .insert(rows as never[])
      .select('*, skus(id, sku_code, name)')

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Inbound create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
