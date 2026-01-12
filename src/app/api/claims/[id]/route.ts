import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'
import { z } from 'zod'

const updateClaimSchema = z.object({
  status: z.enum(['ouverte', 'en_analyse', 'indemnisee', 'refusee', 'cloturee']).optional(),
  description: z.string().optional().nullable(),
  indemnity_eur: z.number().min(0).optional().nullable(),
  decision_note: z.string().optional().nullable(),
  claim_type: z.enum(['lost', 'damaged', 'delay', 'wrong_content', 'missing_items', 'other']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
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

    // Get history
    const { data: history } = await supabase
      .from('claim_history')
      .select(`
        *,
        profiles:changed_by(email, full_name)
      `)
      .eq('claim_id', id)
      .order('changed_at', { ascending: false })

    return NextResponse.json({ claim, history: history || [] })
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

    // Get current claim for history
    const { data: currentClaim } = await supabase
      .from('claims')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!currentClaim) {
      return NextResponse.json(
        { success: false, error: 'Reclamation non trouvee' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = updateClaimSchema.parse(body)

    // Build update object
    const updateData: Record<string, unknown> = {}
    const changes: { field: string; old: unknown; new: unknown }[] = []

    if (validatedData.status !== undefined && validatedData.status !== currentClaim.status) {
      updateData.status = validatedData.status
      changes.push({ field: 'status', old: currentClaim.status, new: validatedData.status })
    }

    if (validatedData.description !== undefined && validatedData.description !== currentClaim.description) {
      updateData.description = validatedData.description
      changes.push({ field: 'description', old: currentClaim.description, new: validatedData.description })
    }

    if (validatedData.indemnity_eur !== undefined && validatedData.indemnity_eur !== currentClaim.indemnity_eur) {
      updateData.indemnity_eur = validatedData.indemnity_eur
      changes.push({ field: 'indemnity_eur', old: currentClaim.indemnity_eur, new: validatedData.indemnity_eur })
    }

    if (validatedData.decision_note !== undefined && validatedData.decision_note !== currentClaim.decision_note) {
      updateData.decision_note = validatedData.decision_note
      changes.push({ field: 'decision_note', old: currentClaim.decision_note, new: validatedData.decision_note })
    }

    if (validatedData.claim_type !== undefined && validatedData.claim_type !== currentClaim.claim_type) {
      updateData.claim_type = validatedData.claim_type
      changes.push({ field: 'claim_type', old: currentClaim.claim_type, new: validatedData.claim_type })
    }

    if (validatedData.priority !== undefined && validatedData.priority !== currentClaim.priority) {
      updateData.priority = validatedData.priority
      changes.push({ field: 'priority', old: currentClaim.priority, new: validatedData.priority })
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

    // Log history if there were changes
    if (changes.length > 0) {
      const action = changes.some(c => c.field === 'status')
        ? 'status_changed'
        : changes.some(c => c.field === 'indemnity_eur')
        ? 'indemnity_set'
        : 'updated'

      await db.from('claim_history').insert({
        claim_id: id,
        tenant_id: tenantId,
        action,
        old_value: Object.fromEntries(changes.map(c => [c.field, c.old])),
        new_value: Object.fromEntries(changes.map(c => [c.field, c.new])),
        changed_by: user?.id,
      })
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
