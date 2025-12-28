import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'
import { z } from 'zod'

const updateClaimSchema = z.object({
  status: z.enum(['ouverte', 'en_analyse', 'indemnisee', 'refusee', 'cloturee']).optional(),
  description: z.string().optional().nullable(),
  indemnity_eur: z.number().min(0).optional().nullable(),
  decision_note: z.string().optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()
    const { id } = await params

    const { data: claim, error } = await supabase
      .from('claims')
      .select(`
        *,
        shipments(sendcloud_id, order_ref, carrier, shipped_at)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Reclamation non trouvee' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ claim })
  } catch (error) {
    console.error('Get claim error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const supabase = await createClient()
    const { id } = await params

    const body = await request.json()
    const validatedData = updateClaimSchema.parse(body)

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status
    }

    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description
    }

    if (validatedData.indemnity_eur !== undefined) {
      updateData.indemnity_eur = validatedData.indemnity_eur
    }

    if (validatedData.decision_note !== undefined) {
      updateData.decision_note = validatedData.decision_note
    }

    // If indemnity or status changed to indemnisee/refusee, set decision info
    if (
      validatedData.indemnity_eur !== undefined ||
      validatedData.status === 'indemnisee' ||
      validatedData.status === 'refusee'
    ) {
      updateData.decided_at = new Date().toISOString()
      updateData.decided_by = user?.id
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: claim, error } = await db
      .from('claims')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Reclamation non trouvee' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, claim })
  } catch (error) {
    console.error('Update claim error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()
    const { id } = await params

    const { error } = await supabase
      .from('claims')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete claim error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
