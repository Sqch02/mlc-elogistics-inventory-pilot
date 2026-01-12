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

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const claim_type = searchParams.get('claim_type')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    let query = supabase
      .from('claims')
      .select(`
        *,
        shipments(sendcloud_id, order_ref, carrier)
      `)
      .eq('tenant_id', tenantId)
      .order('opened_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (claim_type) {
      query = query.eq('claim_type', claim_type)
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    if (from) {
      query = query.gte('opened_at', from)
    }

    if (to) {
      query = query.lte('opened_at', to)
    }

    const { data: claims, error } = await query

    if (error) {
      throw error
    }

    // Filter by search text (order_ref or description)
    let filteredClaims = claims || []
    if (search) {
      const searchLower = search.toLowerCase()
      filteredClaims = filteredClaims.filter(c =>
        c.order_ref?.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower) ||
        c.shipments?.order_ref?.toLowerCase().includes(searchLower) ||
        c.shipments?.carrier?.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({ claims: filteredClaims })
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
