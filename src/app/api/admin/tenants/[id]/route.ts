import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/supabase/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['super_admin'])
    const { id } = await params
    const supabase = createAdminClient()

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single()

    if (tenantError) throw tenantError

    // Get settings
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', id)
      .single()

    // Get users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .eq('tenant_id', id)

    return NextResponse.json({
      tenant,
      settings,
      users: profiles || [],
    })
  } catch (error) {
    console.error('Admin get tenant error:', error)
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
    await requireRole(['super_admin'])
    const { id } = await params
    const supabase = createAdminClient()
    const body = await request.json()

    // Check if settings exist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: existing } = await db
      .from('tenant_settings')
      .select('id')
      .eq('tenant_id', id)
      .single()

    let error
    if (existing) {
      // Update existing
      const result = await db
        .from('tenant_settings')
        .update({
          sendcloud_api_key: body.sendcloud_api_key || null,
          sendcloud_secret: body.sendcloud_secret || null,
          sync_enabled: body.sync_enabled ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', id)
      error = result.error
    } else {
      // Insert new
      const result = await db
        .from('tenant_settings')
        .insert({
          tenant_id: id,
          sendcloud_api_key: body.sendcloud_api_key || null,
          sendcloud_secret: body.sendcloud_secret || null,
          sync_enabled: body.sync_enabled ?? true,
        })
      error = result.error
    }

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin update tenant error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['super_admin'])
    const { id } = await params
    const supabase = createAdminClient()

    // Delete in correct order due to foreign keys
    await supabase.from('tenant_settings').delete().eq('tenant_id', id)
    await supabase.from('profiles').delete().eq('tenant_id', id)

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin delete tenant error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
