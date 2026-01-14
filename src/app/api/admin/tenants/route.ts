import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/supabase/auth'

// Helper to generate tenant code from name
function generateTenantCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 8)
}

// Helper to validate SIREN (9 digits)
function isValidSiren(siren: string): boolean {
  return /^\d{9}$/.test(siren)
}

// Helper to validate SIRET (14 digits)
function isValidSiret(siret: string): boolean {
  return /^\d{14}$/.test(siret)
}

export async function GET() {
  try {
    await requireRole(['super_admin'])
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get all tenants with settings
    const { data: tenants, error } = await db
      .from('tenants')
      .select(`
        id,
        name,
        code,
        city,
        is_active,
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
      code: t.code,
      city: t.city,
      is_active: t.is_active ?? true,
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

    // Validate required field
    if (!body.name) {
      return NextResponse.json(
        { error: 'Le nom du client est requis' },
        { status: 400 }
      )
    }

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

    // Generate code if not provided
    const code = body.code || generateTenantCode(body.name)

    // Create tenant with all fields
    const { data: tenant, error } = await db
      .from('tenants')
      .insert({
        name: body.name,
        code,
        siren: body.siren || null,
        siret: body.siret || null,
        vat_number: body.vat_number || null,
        address: body.address || null,
        postal_code: body.postal_code || null,
        city: body.city || null,
        country: body.country || 'France',
        email: body.email || null,
        phone: body.phone || null,
        logo_url: body.logo_url || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation on code
      if (error.code === '23505' && error.message?.includes('idx_tenants_code')) {
        return NextResponse.json(
          { error: 'Ce code client existe déjà' },
          { status: 400 }
        )
      }
      throw error
    }

    // Create default tenant settings with invoice config
    await db
      .from('tenant_settings')
      .insert({
        tenant_id: tenant.id,
        sync_enabled: true,
        invoice_prefix: body.invoice_prefix || 'FAC',
        invoice_next_number: body.invoice_next_number || 1,
        payment_terms: body.payment_terms || null,
        bank_details: body.bank_details || null,
        default_vat_rate: body.default_vat_rate || 20.00,
      })

    return NextResponse.json({ success: true, tenant })
  } catch (error) {
    console.error('Admin create tenant error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
