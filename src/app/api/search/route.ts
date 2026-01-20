import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant } from '@/lib/supabase/auth'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = adminClient as any

    const searchParams = request.nextUrl.searchParams
    const rawQuery = searchParams.get('q')?.trim()

    if (!rawQuery || rawQuery.length < 2) {
      return NextResponse.json({ results: [] })
    }

    // Sanitize search input to prevent SQL injection
    const query = sanitizeSearchInput(rawQuery)
    if (!query) {
      return NextResponse.json({ results: [] })
    }

    const searchPattern = `%${query}%`

    // Search shipments by order_ref or tracking_number
    const { data: shipments } = await db
      .from('shipments')
      .select('id, order_ref, tracking_number, carrier, status_message, shipped_at')
      .eq('tenant_id', tenantId)
      .or(`order_ref.ilike.${searchPattern},tracking_number.ilike.${searchPattern}`)
      .order('shipped_at', { ascending: false })
      .limit(5)

    // Search claims by order_ref
    const { data: claims } = await db
      .from('claims')
      .select('id, order_ref, status, claim_type, opened_at')
      .eq('tenant_id', tenantId)
      .ilike('order_ref', searchPattern)
      .order('opened_at', { ascending: false })
      .limit(5)

    const results = [
      ...(shipments || []).map((s: {
        id: string
        order_ref: string
        tracking_number: string
        carrier: string
        status_message: string
        shipped_at: string
      }) => ({
        type: 'shipment' as const,
        id: s.id,
        title: s.order_ref || s.tracking_number,
        subtitle: `${s.carrier || 'N/A'} - ${s.status_message || 'En cours'}`,
        date: s.shipped_at,
        url: `/expeditions?search=${encodeURIComponent(s.order_ref || s.tracking_number)}`,
      })),
      ...(claims || []).map((c: {
        id: string
        order_ref: string
        status: string
        claim_type: string
        opened_at: string
      }) => ({
        type: 'claim' as const,
        id: c.id,
        title: c.order_ref,
        subtitle: `Réclamation ${c.status} - ${c.claim_type}`,
        date: c.opened_at,
        url: `/reclamations?search=${encodeURIComponent(c.order_ref)}`,
      })),
    ]

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Erreur de recherche' },
      { status: 500 }
    )
  }
}
