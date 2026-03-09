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

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const adminClient = createAdminClient()

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const claim_type = searchParams.get('claim_type')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '500', 10)))
    const rangeFrom = (page - 1) * limit
    const rangeTo = rangeFrom + limit - 1

    // Build query with server-side filters
    let query = adminClient
      .from('claims')
      .select(`
        *,
        shipments:shipment_id (
          sendcloud_id,
          order_ref,
          carrier,
          tracking,
          tracking_url,
          country_code
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)

    // Apply status filter (supports comma-separated multiple statuses)
    if (status) {
      const statuses = status.split(',')
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0])
      } else {
        query = query.in('status', statuses)
      }
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

    // Text search: use ilike on claim fields, or on the order_ref directly
    // Note: shipment join fields can't be filtered server-side with PostgREST easily,
    // so we apply text search on claim-level fields server-side and keep a lightweight
    // client-side pass for shipment-level fields only when search is provided
    if (search) {
      query = query.or(
        `order_ref.ilike.%${search}%,description.ilike.%${search}%`
      )
    }

    const { data: claims, error, count } = await query
      .order('opened_at', { ascending: false })
      .range(rangeFrom, rangeTo)

    if (error) throw error

    // Lightweight client-side pass for shipment-level text search
    // Only needed when search targets carrier/tracking which live on the joined shipment
    const filteredClaims = claims || []
    if (search && filteredClaims.length === 0) {
      // If the server-side or() returned nothing, try searching shipment fields
      // Re-query without the or() filter and apply client-side search on shipment fields
      let fallbackQuery = adminClient
        .from('claims')
        .select(`
          *,
          shipments:shipment_id (
            sendcloud_id,
            order_ref,
            carrier,
            tracking,
            tracking_url,
            country_code
          )
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)

      if (status) {
        const statuses = status.split(',')
        if (statuses.length === 1) {
          fallbackQuery = fallbackQuery.eq('status', statuses[0])
        } else {
          fallbackQuery = fallbackQuery.in('status', statuses)
        }
      }
      if (claim_type) fallbackQuery = fallbackQuery.eq('claim_type', claim_type)
      if (priority) fallbackQuery = fallbackQuery.eq('priority', priority)
      if (from) fallbackQuery = fallbackQuery.gte('opened_at', from)
      if (to) fallbackQuery = fallbackQuery.lte('opened_at', to)

      const { data: allForSearch, error: fallbackError } = await fallbackQuery
        .order('opened_at', { ascending: false })
        .range(0, 999)

      if (!fallbackError && allForSearch) {
        const searchLower = search.toLowerCase()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matched = allForSearch.filter((c: any) =>
          c.shipments?.order_ref?.toLowerCase().includes(searchLower) ||
          c.shipments?.carrier?.toLowerCase().includes(searchLower) ||
          c.shipments?.tracking?.toLowerCase().includes(searchLower)
        )
        // Apply pagination to matched results
        const sliced = matched.slice(0, limit)
        return NextResponse.json({
          claims: sliced,
          total: matched.length,
          page: 1,
          limit,
        })
      }
    }

    return NextResponse.json({
      claims: filteredClaims,
      total: count ?? filteredClaims.length,
      page,
      limit,
    })
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
