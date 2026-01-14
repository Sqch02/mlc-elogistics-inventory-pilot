import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/supabase/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['super_admin'])
    const { id } = await params
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const body = await request.json()

    const isActive = body.is_active ?? true

    // Update tenant active status
    const { error } = await db
      .from('tenants')
      .update({ is_active: isActive })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: isActive ? 'Client activé' : 'Client désactivé',
    })
  } catch (error) {
    console.error('Admin toggle tenant active error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
