import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { parseCSV } from '@/lib/utils/csv'
import { claimsImportRowSchema, validateRows } from '@/lib/validations/import'

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
    const { valid, invalid } = validateRows(rawData, claimsImportRowSchema)

    if (valid.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune ligne valide',
        errors: invalid.map((i) => `Ligne ${i.row}: ${i.errors.join(', ')}`),
      })
    }

    // Try to link claims to shipments via order_ref
    const orderRefs = valid.map((r) => r.order_ref).filter(Boolean) as string[]
    const { data: shipments } = await supabase
      .from('shipments')
      .select('id, order_ref')
      .eq('tenant_id', tenantId)
      .in('order_ref', orderRefs)

    const shipmentMap = new Map(
      shipments?.map((s: { order_ref: string; id: string }) => [s.order_ref, s.id]) || []
    )

    // Upsert claims
    const claimsToUpsert = valid.map((row) => ({
      tenant_id: tenantId,
      order_ref: row.order_ref,
      shipment_id: shipmentMap.get(row.order_ref) || null,
      claim_type: row.claim_type,
      description: row.description || null,
      status: row.status,
      indemnity_eur: row.indemnity_eur || null,
      priority: row.priority,
      opened_at: row.opened_at || new Date().toISOString(),
      decision_note: row.decision_note || null,
    }))

    const { error: claimError } = await supabase
      .from('claims')
      .upsert(claimsToUpsert, {
        onConflict: 'tenant_id,order_ref',
        ignoreDuplicates: false,
      })

    if (claimError) {
      return NextResponse.json({
        success: false,
        message: `Erreur d'insertion claims: ${claimError.message}`,
      })
    }

    const notLinked = valid.filter((r) => !shipmentMap.has(r.order_ref)).length
    const errorMessages = invalid.map(
      (i) => `Ligne ${i.row}: ${i.errors.join(', ')}`
    )

    return NextResponse.json({
      success: true,
      message: `Import terminé`,
      imported: valid.length,
      linked: valid.length - notLinked,
      warnings: notLinked > 0 ? [`${notLinked} réclamation(s) sans expédition liée`] : undefined,
      errors: errorMessages.length > 0 ? errorMessages : undefined,
    })
  } catch (error) {
    console.error('Claims import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
