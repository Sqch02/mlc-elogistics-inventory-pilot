import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { parseCSV } from '@/lib/utils/csv'
import { pricingImportRowSchema, validateRows } from '@/lib/validations/import'

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const replaceAll = formData.get('replace_all') === 'true'

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Fichier requis' },
        { status: 400 }
      )
    }

    const content = await file.text()
    const { data: rawData, errors: parseErrors } = parseCSV<Record<string, string>>(content)

    if (parseErrors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Erreur de parsing CSV',
        errors: parseErrors,
      })
    }

    // Validate rows
    const { valid, invalid } = validateRows(rawData, pricingImportRowSchema)

    if (valid.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune ligne valide',
        errors: invalid.map((i) => `Ligne ${i.row}: ${i.errors.join(', ')}`),
      })
    }

    // If replaceAll, delete existing pricing rules
    if (replaceAll) {
      await supabase
        .from('pricing_rules')
        .delete()
        .eq('tenant_id', tenantId)
    }

    // Upsert pricing rules
    const pricingToUpsert = valid.map((row) => ({
      tenant_id: tenantId,
      carrier: row.carrier,
      weight_min_grams: row.weight_min_grams,
      weight_max_grams: row.weight_max_grams,
      price_eur: row.price_eur,
    }))

    const { error: insertError } = await supabase
      .from('pricing_rules')
      .upsert(pricingToUpsert, {
        onConflict: 'tenant_id,carrier,weight_min_grams,weight_max_grams',
        ignoreDuplicates: false,
      })

    if (insertError) {
      return NextResponse.json({
        success: false,
        message: `Erreur d'insertion: ${insertError.message}`,
      })
    }

    const errorMessages = invalid.map(
      (i) => `Ligne ${i.row}: ${i.errors.join(', ')}`
    )

    return NextResponse.json({
      success: true,
      message: `Import termine`,
      imported: valid.length,
      errors: errorMessages.length > 0 ? errorMessages : undefined,
    })
  } catch (error) {
    console.error('Pricing import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
