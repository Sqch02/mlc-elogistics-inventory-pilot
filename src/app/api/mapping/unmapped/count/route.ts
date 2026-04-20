import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireRole, requireTenant } from '@/lib/supabase/auth'

// GET /api/mapping/unmapped/count - Count of unresolved unmapped items for the current tenant
// Admin-only: clients should not see internal mapping issues
export async function GET() {
  try {
    await requireRole(['admin', 'super_admin'])
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()

    const { count, error } = await adminClient
      .from('unmapped_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('resolved_at', null)

    if (error) throw error

    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    console.error('[api/mapping/unmapped/count] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
