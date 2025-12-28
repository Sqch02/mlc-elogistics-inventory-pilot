import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { parseCSV } from '@/lib/utils/csv'
import { bundleImportRowSchema, validateRows } from '@/lib/validations/import'

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

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
    const { valid, invalid } = validateRows(rawData, bundleImportRowSchema)

    if (valid.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune ligne valide',
        errors: invalid.map((i) => `Ligne ${i.row}: ${i.errors.join(', ')}`),
      })
    }

    // Get all unique SKU codes
    const allSkuCodes = [
      ...new Set([
        ...valid.map((r) => r.bundle_sku_code),
        ...valid.map((r) => r.component_sku_code),
      ]),
    ]

    // Fetch SKU IDs
    const { data: skus, error: skuError } = await db
      .from('skus')
      .select('id, sku_code')
      .eq('tenant_id', tenantId)
      .in('sku_code', allSkuCodes)

    if (skuError) {
      return NextResponse.json({
        success: false,
        message: `Erreur de lecture SKUs: ${skuError.message}`,
      })
    }

    const skuMap = new Map(skus?.map((s: { sku_code: string; id: string }) => [s.sku_code, s.id]) || [])

    // Check for missing SKUs
    const missingSkus = allSkuCodes.filter((code) => !skuMap.has(code))
    if (missingSkus.length > 0) {
      return NextResponse.json({
        success: false,
        message: `SKUs introuvables: ${missingSkus.join(', ')}`,
        errors: [`Les SKUs suivants doivent etre importes d'abord: ${missingSkus.join(', ')}`],
      })
    }

    // Group by bundle SKU
    const bundleGroups = new Map<string, Array<{ component_sku_code: string; qty_component: number }>>()
    valid.forEach((row) => {
      if (!bundleGroups.has(row.bundle_sku_code)) {
        bundleGroups.set(row.bundle_sku_code, [])
      }
      bundleGroups.get(row.bundle_sku_code)!.push({
        component_sku_code: row.component_sku_code,
        qty_component: row.qty_component,
      })
    })

    let importedCount = 0

    // Process each bundle
    for (const [bundleSkuCode, components] of bundleGroups) {
      const bundleSkuId = skuMap.get(bundleSkuCode)!

      // Upsert bundle
      const { data: bundle, error: bundleError } = await db
        .from('bundles')
        .upsert(
          { tenant_id: tenantId, bundle_sku_id: bundleSkuId },
          { onConflict: 'bundle_sku_id' }
        )
        .select('id')
        .single()

      if (bundleError) {
        console.error('Bundle upsert error:', bundleError)
        continue
      }

      // Delete existing components and insert new ones
      await db
        .from('bundle_components')
        .delete()
        .eq('bundle_id', bundle.id)

      const componentsToInsert = components.map((c) => ({
        tenant_id: tenantId,
        bundle_id: bundle.id,
        component_sku_id: skuMap.get(c.component_sku_code)!,
        qty_component: c.qty_component,
      }))

      const { error: compError } = await db
        .from('bundle_components')
        .insert(componentsToInsert)

      if (!compError) {
        importedCount += components.length
      }
    }

    const errorMessages = invalid.map(
      (i) => `Ligne ${i.row}: ${i.errors.join(', ')}`
    )

    return NextResponse.json({
      success: true,
      message: `Import termine - ${bundleGroups.size} bundle(s)`,
      imported: importedCount,
      errors: errorMessages.length > 0 ? errorMessages : undefined,
    })
  } catch (error) {
    console.error('Bundle import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
