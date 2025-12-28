import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { parseCSV } from '@/lib/utils/csv'
import { restockImportRowSchema, validateRows } from '@/lib/validations/import'

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const formData = await request.formData()
    const file = formData.get('file') as File

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
    const { valid, invalid } = validateRows(rawData, restockImportRowSchema)

    if (valid.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune ligne valide',
        errors: invalid.map((i) => `Ligne ${i.row}: ${i.errors.join(', ')}`),
      })
    }

    // Get SKU IDs
    const skuCodes = [...new Set(valid.map((r) => r.sku_code))]
    const { data: skus } = await supabase
      .from('skus')
      .select('id, sku_code')
      .eq('tenant_id', tenantId)
      .in('sku_code', skuCodes)

    if (!skus || skus.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucun SKU trouve pour les codes fournis',
      })
    }

    const skuMap = new Map(skus.map((s: { sku_code: string; id: string }) => [s.sku_code, s.id]))

    // Check for missing SKUs
    const missingSkus = skuCodes.filter((code) => !skuMap.has(code))
    const warnings: string[] = []
    if (missingSkus.length > 0) {
      warnings.push(`SKUs non trouves: ${missingSkus.join(', ')}`)
    }

    // Build restock entries to insert
    const restockToInsert = valid
      .filter((row) => skuMap.has(row.sku_code))
      .map((row) => ({
        tenant_id: tenantId,
        sku_id: skuMap.get(row.sku_code)!,
        qty: row.qty,
        eta_date: row.eta_date,
        note: row.note || null,
      }))

    if (restockToInsert.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune correspondance trouvee',
        errors: warnings,
      })
    }

    const { error: insertError } = await supabase
      .from('inbound_restock')
      .insert(restockToInsert)

    if (insertError) {
      return NextResponse.json({
        success: false,
        message: `Erreur d'insertion: ${insertError.message}`,
      })
    }

    const errorMessages = [
      ...invalid.map((i) => `Ligne ${i.row}: ${i.errors.join(', ')}`),
      ...warnings,
    ]

    return NextResponse.json({
      success: true,
      message: `Import termine`,
      imported: restockToInsert.length,
      errors: errorMessages.length > 0 ? errorMessages : undefined,
    })
  } catch (error) {
    console.error('Restock import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
