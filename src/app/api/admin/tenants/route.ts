import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, requireRole } from '@/lib/supabase/auth'

export async function GET() {
  try {
    await requireRole(['super_admin'])
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get all tenants with user count
    const { data: tenants, error } = await db
      .from('tenants')
      .select(`
        id,
        name,
        created_at,
        tenant_settings(sync_enabled)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get user counts per tenant
    const { data: profiles } = await db
      .from('profiles')
      .select('tenant_id')

    const userCounts = (profiles || []).reduce((acc: Record<string, number>, p: { tenant_id: string }) => {
      if (p.tenant_id) {
        acc[p.tenant_id] = (acc[p.tenant_id] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTenants = tenants?.map((t: any) => ({
      id: t.id,
      name: t.name,
      created_at: t.created_at,
      user_count: userCounts[t.id] || 0,
      sync_enabled: t.tenant_settings?.[0]?.sync_enabled ?? true,
    }))

    return NextResponse.json({ tenants: formattedTenants })
  } catch (error) {
    console.error('Admin get tenants error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(['super_admin'])
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const body = await request.json()

    const { data: tenant, error } = await db
      .from('tenants')
      .insert({ name: body.name })
      .select()
      .single()

    if (error) throw error

    // Create default tenant settings
    await db
      .from('tenant_settings')
      .insert({ tenant_id: tenant.id, sync_enabled: true })

    return NextResponse.json({ success: true, tenant })
  } catch (error) {
    console.error('Admin create tenant error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
