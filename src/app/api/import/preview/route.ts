import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { parseCSV } from '@/lib/utils/csv'
import { analyzeImportData, type ImportPreviewResult } from '@/lib/utils/fuzzy-match'
import { z } from 'zod'
import {
  skuImportRowSchema,
  pricingImportRowSchema,
  locationImportRowSchema,
  bundleImportRowSchema,
  claimsImportRowSchema,
  validateRows,
} from '@/lib/validations/import'

type ImportType = 'skus' | 'pricing' | 'locations' | 'bundles' | 'claims'

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const importType = formData.get('type') as ImportType

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Fichier requis' },
        { status: 400 }
      )
    }

    if (!importType) {
      return NextResponse.json(
        { success: false, message: 'Type d\'import requis' },
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

    // Get schema and existing records based on import type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schema: z.ZodSchema<any>
    let existingRecords: Array<{ id: string; code: string }> = []
    let getKeyFromRow: (row: Record<string, unknown>) => string

    switch (importType) {
      case 'skus': {
        schema = skuImportRowSchema as z.ZodSchema<unknown>
        const { data: skus } = await supabase
          .from('skus')
          .select('id, sku_code')
          .eq('tenant_id', tenantId)
        existingRecords = skus?.map((s: { id: string; sku_code: string }) => ({
          id: s.id,
          code: s.sku_code,
        })) || []
        getKeyFromRow = (row) => String(row.sku_code || '')
        break
      }

      case 'pricing': {
        schema = pricingImportRowSchema as z.ZodSchema<unknown>
        const { data: rules } = await supabase
          .from('pricing_rules')
          .select('id, carrier, weight_min_grams, weight_max_grams')
          .eq('tenant_id', tenantId)
        existingRecords = rules?.map((r: { id: string; carrier: string; weight_min_grams: number; weight_max_grams: number }) => ({
          id: r.id,
          code: `${r.carrier}|${r.weight_min_grams}-${r.weight_max_grams}`,
        })) || []
        getKeyFromRow = (row) => `${row.carrier}|${row.weight_min_grams}-${row.weight_max_grams}`
        break
      }

      case 'locations': {
        schema = locationImportRowSchema as z.ZodSchema<unknown>
        const { data: locations } = await supabase
          .from('locations')
          .select('id, code')
          .eq('tenant_id', tenantId)
        existingRecords = locations?.map((l: { id: string; code: string }) => ({
          id: l.id,
          code: l.code,
        })) || []
        getKeyFromRow = (row) => String(row.code || '')
        break
      }

      case 'bundles': {
        schema = bundleImportRowSchema as z.ZodSchema<unknown>
        const { data: bundles } = await supabase
          .from('bundles')
          .select('id, bundle_sku:skus!bundles_bundle_sku_id_fkey(sku_code)')
          .eq('tenant_id', tenantId)
        existingRecords = bundles?.map((b: { id: string; bundle_sku: { sku_code: string } | null }) => ({
          id: b.id,
          code: b.bundle_sku?.sku_code || '',
        })).filter((b: { code: string }) => b.code) || []
        getKeyFromRow = (row) => String(row.bundle_sku_code || '')
        break
      }

      case 'claims': {
        schema = claimsImportRowSchema as z.ZodSchema<unknown>
        const { data: claims } = await supabase
          .from('claims')
          .select('id, order_ref')
          .eq('tenant_id', tenantId)
        existingRecords = claims?.map((c: { id: string; order_ref: string | null }) => ({
          id: c.id,
          code: c.order_ref || '',
        })).filter((c: { code: string }) => c.code) || []
        getKeyFromRow = (row) => String(row.order_ref || '')
        break
      }

      default:
        return NextResponse.json(
          { success: false, message: `Type d'import non supporté: ${importType}` },
          { status: 400 }
        )
    }

    // Validate rows
    const { valid, invalid } = validateRows(rawData, schema)

    // Analyze valid rows for matches
    const preview = analyzeImportData(
      valid as Record<string, unknown>[],
      existingRecords,
      getKeyFromRow
    )

    // Add validation errors to preview
    invalid.forEach((inv) => {
      preview.errors.push({
        rowNumber: inv.row,
        data: inv.data as Record<string, unknown>,
        action: 'error',
        errors: inv.errors,
      })
      preview.summary.errors++
    })

    // Recalculate total
    preview.summary.total = rawData.length

    return NextResponse.json({
      success: true,
      preview,
      existingCount: existingRecords.length,
    })
  } catch (error) {
    console.error('Import preview error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
