import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/supabase/auth'
import { getAdminDb } from '@/lib/supabase/untyped'

export async function GET() {
  try {
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()

    const { data, error } = await adminClient
      .from('tenant_settings')
      .select(`
        company_name,
        company_address,
        company_city,
        company_postal_code,
        company_country,
        company_vat_number,
        company_siret,
        company_email,
        company_phone,
        invoice_payment_terms,
        invoice_bank_details,
        invoice_prefix,
        invoice_next_number
      `)
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching company settings:', error)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    // Also fetch tenant (client) info for PDF invoices
    const { data: tenantData } = await adminClient
      .from('tenants')
      .select('name, address, postal_code, city, country, vat_number')
      .eq('id', tenantId)
      .single()

    return NextResponse.json({
      company_name: data?.company_name || '',
      company_address: data?.company_address || '',
      company_city: data?.company_city || '',
      company_postal_code: data?.company_postal_code || '',
      company_country: data?.company_country || 'France',
      company_vat_number: data?.company_vat_number || '',
      company_siret: data?.company_siret || '',
      company_email: data?.company_email || '',
      company_phone: data?.company_phone || '',
      invoice_payment_terms: data?.invoice_payment_terms || 'Paiement à 30 jours',
      invoice_bank_details: data?.invoice_bank_details || '',
      invoice_prefix: data?.invoice_prefix || 'FAC',
      invoice_next_number: data?.invoice_next_number || 1,
      client_name: tenantData?.name || '',
      client_address: tenantData?.address || '',
      client_postal_code: tenantData?.postal_code || '',
      client_city: tenantData?.city || '',
      client_country: tenantData?.country || '',
      client_vat_number: tenantData?.vat_number || '',
    })
  } catch (error) {
    console.error('Company settings GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()
    const body = await request.json()

    // Validate and sanitize input
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'company_name',
      'company_address',
      'company_city',
      'company_postal_code',
      'company_country',
      'company_vat_number',
      'company_siret',
      'company_email',
      'company_phone',
      'invoice_payment_terms',
      'invoice_bank_details',
      'invoice_prefix',
      'invoice_next_number',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Check if tenant_settings row exists
    const { data: existing } = await adminClient
      .from('tenant_settings')
      .select('id')
      .eq('tenant_id', tenantId)
      .single()

    if (existing) {
      // Update existing
      const { error } = await adminClient
        .from('tenant_settings')
        .update(updateData)
        .eq('tenant_id', tenantId)

      if (error) {
        console.error('Error updating company settings:', error)
        return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
      }
    } else {
      // Insert new
      const { error } = await adminClient
        .from('tenant_settings')
        .insert({
          tenant_id: tenantId,
          ...updateData,
        })

      if (error) {
        console.error('Error inserting company settings:', error)
        return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Company settings PATCH error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
