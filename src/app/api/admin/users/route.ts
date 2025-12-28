import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/supabase/auth'

export async function GET() {
  try {
    await requireRole(['super_admin'])
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get all profiles with tenant names
    const { data: profiles, error } = await db
      .from('profiles')
      .select(`
        id,
        email,
        role,
        tenant_id,
        created_at,
        tenants(name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = profiles?.map((p: any) => ({
      id: p.id,
      email: p.email,
      role: p.role,
      tenant_id: p.tenant_id,
      tenant_name: p.tenants?.name || null,
      created_at: p.created_at,
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin get users error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
