import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'
import { auditCreate } from '@/lib/audit'
import { z } from 'zod'

const createClaimSchema = z.object({
  shipment_id: z.string().uuid().optional().nullable(),
  order_ref: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['ouverte', 'en_analyse', 'indemnisee', 'refusee', 'cloturee']).optional().default('ouverte'),
  claim_type: z.enum(['lost', 'damaged', 'delay', 'wrong_content', 'missing_items', 'other']).optional().default('other'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
})

// Fetch all claims with pagination to bypass 1000 row limit
async function fetchAllClaims(tenantId: string) {
  const adminClient = createAdminClient()
  const allClaims: unknown[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await adminClient
      .from('claims')
      .select(`
        *,
        shipments:shipment_id (
          sendcloud_id,
          order_ref,
          carrier,
          tracking,
          country_code
        )
      `)
      .eq('tenant_id', tenantId)
      .order('opened_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    if (data && data.length > 0) {
      allClaims.push(...data)
      offset += pageSize
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return allClaims
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const claim_type = searchParams.get('claim_type')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Fetch all claims using pagination
    const rawClaims = await fetchAllClaims(tenantId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let claims = rawClaims as any[]

    // Apply filters
    if (status) {
      // Support multiple statuses separated by comma
      const statuses = status.split(',')
      claims = claims.filter((c: { status: string }) => statuses.includes(c.status))
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

    // Filter by search text (order_ref, description, tracking)
    if (search) {
      const searchLower = search.toLowerCase()
      claims = claims.filter((c: { order_ref?: string; description?: string; shipments?: { order_ref?: string; carrier?: string; tracking?: string } }) =>
        c.order_ref?.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower) ||
        c.shipments?.order_ref?.toLowerCase().includes(searchLower) ||
        c.shipments?.carrier?.toLowerCase().includes(searchLower) ||
        c.shipments?.tracking?.toLowerCase().includes(searchLower)
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

    // Audit log
    await auditCreate(
      tenantId,
      user?.id || null,
      'claim',
      claim.id,
      claim,
      request.headers
    )

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
