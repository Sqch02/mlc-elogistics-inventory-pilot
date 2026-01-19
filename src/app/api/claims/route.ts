import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'
import { z } from 'zod'

const createClaimSchema = z.object({
  shipment_id: z.string().uuid().optional().nullable(),
  order_ref: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['ouverte', 'en_analyse', 'indemnisee', 'refusee', 'cloturee']).optional().default('ouverte'),
  claim_type: z.enum(['lost', 'damaged', 'delay', 'wrong_content', 'missing_items', 'other']).optional().default('other'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
})

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const claim_type = searchParams.get('claim_type')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Use RPC function to bypass 1000 row limit
    const { data: rawClaims, error } = await db.rpc('get_all_claims', {
      p_tenant_id: tenantId
    })

    if (error) {
      throw error
    }

    // Transform RPC result to match expected format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let claims = (rawClaims || []).map((c: any) => ({
      ...c,
      shipments: c.shipment_sendcloud_id ? {
        sendcloud_id: c.shipment_sendcloud_id,
        order_ref: c.shipment_order_ref,
        carrier: c.shipment_carrier,
      } : null,
    }))

    // Apply filters
    if (status) {
      claims = claims.filter((c: { status: string }) => c.status === status)
    }

    if (claim_type) {
      claims = claims.filter((c: { claim_type: string }) => c.claim_type === claim_type)
    }

    if (priority) {
      claims = claims.filter((c: { priority: string }) => c.priority === priority)
    }

    if (from) {
      claims = claims.filter((c: { opened_at: string }) => c.opened_at >= from)
    }

    if (to) {
      claims = claims.filter((c: { opened_at: string }) => c.opened_at <= to)
    }

    // Filter by search text (order_ref or description)
    if (search) {
      const searchLower = search.toLowerCase()
      claims = claims.filter((c: { order_ref?: string; description?: string; shipments?: { order_ref?: string; carrier?: string } }) =>
        c.order_ref?.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower) ||
        c.shipments?.order_ref?.toLowerCase().includes(searchLower) ||
        c.shipments?.carrier?.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({ claims })
  } catch (error) {
    console.error('Get claims error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const body = await request.json()
    const validatedData = createClaimSchema.parse(body)

    // Calculer deadline basée sur la priorité (SLA)
    const now = new Date()
    const deadlineDays = {
      urgent: 1,
      high: 3,
      normal: 7,
      low: 14,
    }
    const deadline = new Date(now.getTime() + deadlineDays[validatedData.priority || 'normal'] * 24 * 60 * 60 * 1000)

    const { data: claim, error } = await db
      .from('claims')
      .insert({
        tenant_id: tenantId,
        shipment_id: validatedData.shipment_id || null,
        order_ref: validatedData.order_ref || null,
        description: validatedData.description || null,
        status: validatedData.status,
        claim_type: validatedData.claim_type,
        priority: validatedData.priority,
        resolution_deadline: deadline.toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Log history
    await db.from('claim_history').insert({
      claim_id: claim.id,
      tenant_id: tenantId,
      action: 'created',
      new_value: { status: claim.status, claim_type: claim.claim_type, priority: claim.priority },
      changed_by: user?.id,
      note: 'Réclamation créée',
    })

    return NextResponse.json({ success: true, claim })
  } catch (error) {
    console.error('Create claim error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
