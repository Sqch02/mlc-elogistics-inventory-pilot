import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { parseCSV } from '@/lib/utils/csv'
import { skuImportRowSchema, validateRows, type SKUImportRow } from '@/lib/validations/import'

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
    const { valid, invalid } = validateRows(rawData, skuImportRowSchema)

    if (valid.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune ligne valide',
        errors: invalid.map((i) => `Ligne ${i.row}: ${i.errors.join(', ')}`),
      })
    }

    // Upsert SKUs
    const skusToUpsert = valid.map((row) => ({
      tenant_id: tenantId,
      sku_code: row.sku_code,
      name: row.name,
      weight_grams: row.weight_grams || null,
      active: row.active,
    }))

    const { data: upsertedSkus, error: skuError } = await supabase
      .from('skus')
      .upsert(skusToUpsert, {
        onConflict: 'tenant_id,sku_code',
        ignoreDuplicates: false,
      })
      .select('id, sku_code')

    if (skuError) {
      return NextResponse.json({
        success: false,
        message: `Erreur d'insertion SKUs: ${skuError.message}`,
      })
    }

    // Create/update stock snapshots for rows with qty_current
    const skusWithStock = valid.filter((row) => row.qty_current && row.qty_current > 0)
    if (skusWithStock.length > 0 && upsertedSkus) {
      // Get SKU IDs by code
      const { data: skuIds } = await supabase
        .from('skus')
        .select('id, sku_code')
        .eq('tenant_id', tenantId)
        .in('sku_code', skusWithStock.map((s) => s.sku_code))

      if (skuIds) {
        const skuIdMap = new Map(skuIds.map((s: { sku_code: string; id: string }) => [s.sku_code, s.id]))

        const stockToUpsert = skusWithStock
          .filter((row) => skuIdMap.has(row.sku_code))
          .map((row) => ({
            tenant_id: tenantId,
            sku_id: skuIdMap.get(row.sku_code)!,
            qty_current: row.qty_current || 0,
          }))

        if (stockToUpsert.length > 0) {
          await supabase
            .from('stock_snapshots')
            .upsert(stockToUpsert, {
              onConflict: 'sku_id',
              ignoreDuplicates: false,
            })
        }
      }
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
    console.error('SKU import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
