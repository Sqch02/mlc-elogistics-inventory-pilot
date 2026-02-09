import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant, requireRole, getCurrentUser } from '@/lib/supabase/auth'

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

// POST: Create a new inbound restock entry (client declares arrival)
export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const adminClient = createAdminClient()

    const body = await request.json()
    const { sku_id, qty, eta_date, note, supplier, batch_reference } = body

    if (!sku_id || !qty || !eta_date) {
      return NextResponse.json(
        { error: 'sku_id, qty et eta_date sont requis' },
        { status: 400 }
      )
    }

    if (qty <= 0) {
      return NextResponse.json(
        { error: 'La quantite doit etre superieure a 0' },
        { status: 400 }
      )
    }

    // Verify SKU belongs to tenant
    const { data: sku } = await adminClient
      .from('skus')
      .select('id')
      .eq('id', sku_id)
      .eq('tenant_id', tenantId)
      .single()

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU non trouve' },
        { status: 404 }
      )
    }

    const { data, error } = await adminClient
      .from('inbound_restock')
      .insert({
        tenant_id: tenantId,
        sku_id,
        qty,
        eta_date,
        note: note || null,
        supplier: supplier || null,
        batch_reference: batch_reference || null,
        status: 'pending',
        received: false,
        created_by: user?.id || null,
      } as never)
      .select('*, skus(id, sku_code, name)')
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Inbound create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
