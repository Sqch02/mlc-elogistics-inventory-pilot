import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant } from '@/lib/supabase/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()
    const { id } = await params
    const { status } = await request.json()

    // Validate status
    if (!['draft', 'sent', 'paid'].includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide' },
        { status: 400 }
      )
    }

    // Update invoice status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { error } = await db
      .from('invoices_monthly')
      .update({ status })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error('Update invoice status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
