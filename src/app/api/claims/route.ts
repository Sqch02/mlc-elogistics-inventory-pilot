import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant } from '@/lib/supabase/auth'
import { z } from 'zod'

const createClaimSchema = z.object({
  shipment_id: z.string().uuid().optional().nullable(),
  order_ref: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['ouverte', 'en_analyse', 'indemnisee', 'refusee', 'cloturee']).optional().default('ouverte'),
})

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
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
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const body = await request.json()
    const validatedData = createClaimSchema.parse(body)

    const { data: claim, error } = await db
      .from('claims')
      .insert({
        tenant_id: tenantId,
        shipment_id: validatedData.shipment_id || null,
        order_ref: validatedData.order_ref || null,
        description: validatedData.description || null,
        status: validatedData.status,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

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
