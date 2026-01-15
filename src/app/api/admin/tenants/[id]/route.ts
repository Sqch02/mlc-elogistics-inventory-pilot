import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/supabase/auth'

// Helper to validate SIREN (9 digits)
function isValidSiren(siren: string): boolean {
  return /^\d{9}$/.test(siren)
}

// Helper to validate SIRET (14 digits)
function isValidSiret(siret: string): boolean {
  return /^\d{14}$/.test(siret)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['super_admin'])
    const { id } = await params
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get tenant with all new fields
    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single()

    if (tenantError) throw tenantError

    // Get settings with invoice fields
    const { data: settings } = await db
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', id)
      .single()

    // Get users
    const { data: profiles } = await db
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const body = await request.json()

    // Validate SIREN if provided
    if (body.siren && !isValidSiren(body.siren)) {
      return NextResponse.json(
        { error: 'Le SIREN doit contenir exactement 9 chiffres' },
        { status: 400 }
      )
    }

    // Validate SIRET if provided
    if (body.siret && !isValidSiret(body.siret)) {
      return NextResponse.json(
        { error: 'Le SIRET doit contenir exactement 14 chiffres' },
        { status: 400 }
      )
    }

    // Update tenant fields if any provided
    const tenantFields: Record<string, unknown> = {}
    const tenantFieldNames = [
      'name', 'code', 'siren', 'siret', 'vat_number',
      'address', 'postal_code', 'city', 'country',
      'email', 'phone', 'logo_url', 'is_active'
    ]

    for (const field of tenantFieldNames) {
      if (body[field] !== undefined) {
        tenantFields[field] = body[field]
      }
    }

    if (Object.keys(tenantFields).length > 0) {
      const { error: tenantError } = await db
        .from('tenants')
        .update(tenantFields)
        .eq('id', id)

      if (tenantError) {
        // Handle unique constraint violation on code
        if (tenantError.code === '23505' && tenantError.message?.includes('idx_tenants_code')) {
          return NextResponse.json(
            { error: 'Ce code client existe déjà' },
            { status: 400 }
          )
        }
        throw tenantError
      }
    }

    // Check if settings exist
    const { data: existing } = await db
      .from('tenant_settings')
      .select('id')
      .eq('tenant_id', id)
      .single()

    // Build settings update
    const settingsFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    const settingsFieldNames = [
      'sendcloud_api_key', 'sendcloud_secret', 'sendcloud_webhook_secret', 'sync_enabled',
      'invoice_prefix', 'invoice_next_number', 'payment_terms',
      'bank_details', 'default_vat_rate'
    ]

    for (const field of settingsFieldNames) {
      if (body[field] !== undefined) {
        settingsFields[field] = body[field]
      }
    }

    let settingsError
    if (existing) {
      // Update existing
      const result = await db
        .from('tenant_settings')
        .update(settingsFields)
        .eq('tenant_id', id)
      settingsError = result.error
    } else {
      // Insert new
      const result = await db
        .from('tenant_settings')
        .insert({
          tenant_id: id,
          ...settingsFields,
        })
      settingsError = result.error
    }

    if (settingsError) throw settingsError

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
