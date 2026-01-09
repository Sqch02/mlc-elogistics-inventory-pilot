import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

interface Shipment {
  id: string
  carrier: string
  weight_grams: number
  pricing_status: string
  computed_cost_eur: number | null
}

interface PricingRule {
  carrier: string
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const { month } = await request.json()

    // Validate month format (YYYY-MM)
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { success: false, message: 'Format mois invalide (YYYY-MM)' },
        { status: 400 }
      )
    }

    // Parse month dates
    const [year, monthNum] = month.split('-').map(Number)
    const startOfMonth = new Date(year, monthNum - 1, 1)
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999)

    // Get all shipments for the month
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select('id, carrier, weight_grams, pricing_status, computed_cost_eur')
      .eq('tenant_id', tenantId)
      .gte('shipped_at', startOfMonth.toISOString())
      .lte('shipped_at', endOfMonth.toISOString())

    if (shipmentsError) {
      throw shipmentsError
    }

    if (!shipments || shipments.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Aucune expedition pour ce mois',
      })
    }

    // Get pricing rules for grouping
    const { data: pricingRules } = await supabase
      .from('pricing_rules')
      .select('carrier, weight_min_grams, weight_max_grams, price_eur')
      .eq('tenant_id', tenantId)

    // Group shipments by carrier and weight tier
    const lineGroups = new Map<
      string,
      {
        carrier: string
        weight_min_grams: number
        weight_max_grams: number
        shipment_count: number
        total_eur: number
        unit_price_eur: number
      }
    >()

    let missingPricingCount = 0
    let totalEur = 0

    shipments.forEach((shipment: Shipment) => {
      if (shipment.pricing_status === 'missing' || !shipment.computed_cost_eur) {
        missingPricingCount++
        return
      }

      // Find matching pricing rule for grouping
      const rule = (pricingRules as PricingRule[] | null)?.find(
        (r: PricingRule) =>
          r.carrier.toLowerCase() === shipment.carrier.toLowerCase() &&
          r.weight_min_grams <= shipment.weight_grams &&
          r.weight_max_grams > shipment.weight_grams
      )

      if (!rule) {
        missingPricingCount++
        return
      }

      const key = `${shipment.carrier}|${rule.weight_min_grams}|${rule.weight_max_grams}`
      const existing = lineGroups.get(key)

      if (existing) {
        existing.shipment_count++
        existing.total_eur += Number(shipment.computed_cost_eur)
      } else {
        lineGroups.set(key, {
          carrier: shipment.carrier,
          weight_min_grams: rule.weight_min_grams,
          weight_max_grams: rule.weight_max_grams,
          shipment_count: 1,
          total_eur: Number(shipment.computed_cost_eur),
          unit_price_eur: rule.price_eur,
        })
      }

      totalEur += Number(shipment.computed_cost_eur)
    })

    // Check if invoice already exists for this month
    const { data: existingInvoice } = await supabase
      .from('invoices_monthly')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .single()

    let invoiceId: string

    if (existingInvoice) {
      // Update existing invoice
      await supabase
        .from('invoices_monthly')
        .update({
          total_eur: totalEur,
          missing_pricing_count: missingPricingCount,
          status: 'draft',
        })
        .eq('id', existingInvoice.id)

      invoiceId = existingInvoice.id

      // Delete existing lines
      await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', invoiceId)
    } else {
      // Create new invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices_monthly')
        .insert({
          tenant_id: tenantId,
          month,
          total_eur: totalEur,
          missing_pricing_count: missingPricingCount,
          status: 'draft',
        })
        .select('id')
        .single()

      if (invoiceError || !newInvoice) {
        throw invoiceError || new Error('Failed to create invoice')
      }

      invoiceId = newInvoice.id
    }

    // Create invoice lines
    const lines = Array.from(lineGroups.values()).map((line) => ({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      carrier: line.carrier,
      weight_min_grams: line.weight_min_grams,
      weight_max_grams: line.weight_max_grams,
      shipment_count: line.shipment_count,
      total_eur: line.total_eur,
      unit_price_eur: line.unit_price_eur,
    }))

    if (lines.length > 0) {
      const { error: linesError } = await supabase.from('invoice_lines').insert(lines)
      if (linesError) {
        console.error('Failed to insert invoice lines:', linesError)
        throw new Error('Erreur lors de la création des lignes de facture')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Facture generee',
      invoice: {
        id: invoiceId,
        month,
        total_eur: totalEur,
        shipment_count: shipments.length,
        missing_pricing_count: missingPricingCount,
        line_count: lines.length,
      },
    })
  } catch (error) {
    console.error('Invoice generation error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur serveur',
      },
      { status: 500 }
    )
  }
}
