import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { parseCSV } from '@/lib/utils/csv'
import { locationImportRowSchema, validateRows } from '@/lib/validations/import'

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
    const { valid, invalid } = validateRows(rawData, locationImportRowSchema)

    if (valid.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune ligne valide',
        errors: invalid.map((i) => `Ligne ${i.row}: ${i.errors.join(', ')}`),
      })
    }

    // Upsert locations
    const locationsToUpsert = valid.map((row) => ({
      tenant_id: tenantId,
      code: row.code,
      label: row.label || null,
      active: row.active,
    }))

    const { error: locationError } = await supabase
      .from('locations')
      .upsert(locationsToUpsert, {
        onConflict: 'tenant_id,code',
        ignoreDuplicates: false,
      })

    if (locationError) {
      return NextResponse.json({
        success: false,
        message: `Erreur d'insertion locations: ${locationError.message}`,
      })
    }

    // Handle SKU assignments if present
    const rowsWithSku = valid.filter((row) => row.sku_code)
    if (rowsWithSku.length > 0) {
      // Get location IDs
      const { data: locations } = await supabase
        .from('locations')
        .select('id, code')
        .eq('tenant_id', tenantId)
        .in('code', rowsWithSku.map((r) => r.code))

      // Get SKU IDs
      const skuCodes = rowsWithSku.map((r) => r.sku_code!).filter(Boolean)
      const { data: skus } = await supabase
        .from('skus')
        .select('id, sku_code')
        .eq('tenant_id', tenantId)
        .in('sku_code', skuCodes)

      if (locations && skus) {
        const locationMap = new Map(locations.map((l: { code: string; id: string }) => [l.code, l.id]))
        const skuMap = new Map(skus.map((s: { sku_code: string; id: string }) => [s.sku_code, s.id]))

        const assignmentsToUpsert = rowsWithSku
          .filter((row) => locationMap.has(row.code) && skuMap.has(row.sku_code!))
          .map((row) => ({
            tenant_id: tenantId,
            location_id: locationMap.get(row.code)!,
            sku_id: skuMap.get(row.sku_code!)!,
          }))

        if (assignmentsToUpsert.length > 0) {
          // Delete existing assignments for these locations first
          await supabase
            .from('location_assignments')
            .delete()
            .in('location_id', assignmentsToUpsert.map((a) => a.location_id))

          await supabase
            .from('location_assignments')
            .insert(assignmentsToUpsert)
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
    console.error('Location import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
