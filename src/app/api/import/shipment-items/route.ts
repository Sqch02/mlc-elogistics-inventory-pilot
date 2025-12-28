import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { parseCSV } from '@/lib/utils/csv'
import { shipmentItemsImportRowSchema, validateRows } from '@/lib/validations/import'

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
    const { valid, invalid } = validateRows(rawData, shipmentItemsImportRowSchema)

    if (valid.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune ligne valide',
        errors: invalid.map((i) => `Ligne ${i.row}: ${i.errors.join(', ')}`),
      })
    }

    // Get shipment IDs by sendcloud_id
    const sendcloudIds = [...new Set(valid.map((r) => r.sendcloud_id))]
    const { data: shipments } = await supabase
      .from('shipments')
      .select('id, sendcloud_id')
      .eq('tenant_id', tenantId)
      .in('sendcloud_id', sendcloudIds)

    if (!shipments || shipments.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune expedition trouvee pour les sendcloud_id fournis',
      })
    }

    const shipmentMap = new Map(shipments.map((s: { sendcloud_id: string; id: string }) => [s.sendcloud_id, s.id]))

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

    // Check for missing references
    const missingSendcloud = sendcloudIds.filter((id) => !shipmentMap.has(id))
    const missingSkus = skuCodes.filter((code) => !skuMap.has(code))

    const warnings: string[] = []
    if (missingSendcloud.length > 0) {
      warnings.push(`Expeditions non trouvees: ${missingSendcloud.join(', ')}`)
    }
    if (missingSkus.length > 0) {
      warnings.push(`SKUs non trouves: ${missingSkus.join(', ')}`)
    }

    // Build items to insert
    const itemsToInsert = valid
      .filter((row) => shipmentMap.has(row.sendcloud_id) && skuMap.has(row.sku_code))
      .map((row) => ({
        tenant_id: tenantId,
        shipment_id: shipmentMap.get(row.sendcloud_id)!,
        sku_id: skuMap.get(row.sku_code)!,
        qty: row.qty,
      }))

    if (itemsToInsert.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune correspondance trouvee',
        errors: warnings,
      })
    }

    // Upsert shipment items
    const { error: insertError } = await supabase
      .from('shipment_items')
      .upsert(itemsToInsert, {
        onConflict: 'shipment_id,sku_id',
        ignoreDuplicates: false,
      })

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
      imported: itemsToInsert.length,
      errors: errorMessages.length > 0 ? errorMessages : undefined,
    })
  } catch (error) {
    console.error('Shipment items import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
