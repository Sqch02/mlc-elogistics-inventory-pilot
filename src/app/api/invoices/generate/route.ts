import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

interface TenantSettings {
  invoice_prefix: string | null
  invoice_next_number: number | null
  default_vat_rate: number | null
}

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

interface BillingConfig {
  software_fee_eur: number
  storage_fee_per_m3: number
  reception_fee_per_15min: number
  fuel_surcharge_pct: number
  return_fee_eur: number
  free_returns_pct: number
  vat_rate_pct: number
}

interface InvoiceLine {
  tenant_id: string
  invoice_id: string
  line_type: string
  description: string
  carrier: string | null
  weight_min_grams: number | null
  weight_max_grams: number | null
  shipment_count: number
  quantity: number
  unit_price_eur: number
  total_eur: number
  vat_amount: number
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const { month, storage_m3 = 0, reception_quarters = 0 } = await request.json()

    // Validate month format (YYYY-MM)
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { success: false, message: 'Format mois invalide (YYYY-MM)' },
        { status: 400 }
      )
    }

    // Get billing config (may not exist, use defaults)
    const { data: billingConfig } = await supabase
      .from('tenant_billing_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    // Get tenant settings for invoice numbering (may not exist, use defaults)
    const { data: tenantSettings } = await supabase
      .from('tenant_settings')
      .select('invoice_prefix, invoice_next_number, default_vat_rate')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const invoiceSettings: TenantSettings = tenantSettings || {
      invoice_prefix: 'FAC',
      invoice_next_number: 1,
      default_vat_rate: 20.00,
    }

    const config: BillingConfig = billingConfig || {
      software_fee_eur: 49.00,
      storage_fee_per_m3: 25.00,
      reception_fee_per_15min: 30.00,
      fuel_surcharge_pct: 4.00,
      return_fee_eur: 0.90,
      free_returns_pct: 0.50,
      vat_rate_pct: invoiceSettings.default_vat_rate || 20.00,
    }

    // Parse month dates
    const [year, monthNum] = month.split('-').map(Number)
    const startOfMonth = new Date(year, monthNum - 1, 1)
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999)

    // Get all shipments for the month (with pagination to bypass 1000 limit)
    const allShipments: Shipment[] = []
    const pageSize = 1000
    let page = 0
    let hasMore = true

    while (hasMore) {
      const { data: shipmentPage, error: shipmentsError } = await supabase
        .from('shipments')
        .select('id, carrier, weight_grams, pricing_status, computed_cost_eur')
        .eq('tenant_id', tenantId)
        .eq('is_return', false)
        .gte('shipped_at', startOfMonth.toISOString())
        .lte('shipped_at', endOfMonth.toISOString())
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('shipped_at')

      if (shipmentsError) {
        throw shipmentsError
      }

      if (shipmentPage && shipmentPage.length > 0) {
        allShipments.push(...(shipmentPage as Shipment[]))
        hasMore = shipmentPage.length === pageSize
        page++
      } else {
        hasMore = false
      }
    }

    // Get returns count for the month
    const { count: returnsCount } = await supabase
      .from('returns')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())

    const totalReturns = returnsCount || 0

    // Get pricing rules for grouping
    const { data: pricingRules } = await supabase
      .from('pricing_rules')
      .select('carrier, weight_min_grams, weight_max_grams, price_eur')
      .eq('tenant_id', tenantId)

    // Group shipments by carrier and weight tier
    const shippingGroups = new Map<
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
    let shippingTotalEur = 0

    allShipments.forEach((shipment: Shipment) => {
      if (shipment.pricing_status === 'missing' || !shipment.computed_cost_eur) {
        missingPricingCount++
        return
      }

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
      const existing = shippingGroups.get(key)

      if (existing) {
        existing.shipment_count++
        existing.total_eur += Number(shipment.computed_cost_eur)
      } else {
        shippingGroups.set(key, {
          carrier: shipment.carrier,
          weight_min_grams: rule.weight_min_grams,
          weight_max_grams: rule.weight_max_grams,
          shipment_count: 1,
          total_eur: Number(shipment.computed_cost_eur),
          unit_price_eur: rule.price_eur,
        })
      }

      shippingTotalEur += Number(shipment.computed_cost_eur)
    })

    // Calculate all invoice line totals
    const vatRate = config.vat_rate_pct / 100

    // 1. Software fee (fixed monthly)
    const softwareFee = config.software_fee_eur
    const softwareVat = softwareFee * vatRate

    // 2. Storage fee (per m3)
    const storageFee = storage_m3 * config.storage_fee_per_m3
    const storageVat = storageFee * vatRate

    // 3. Reception fee (per 15min quarter)
    const receptionFee = reception_quarters * config.reception_fee_per_15min
    const receptionVat = receptionFee * vatRate

    // 4. Shipping total (already calculated)
    const shippingVat = shippingTotalEur * vatRate

    // 5. Fuel surcharge (4% of shipping)
    const fuelSurcharge = shippingTotalEur * (config.fuel_surcharge_pct / 100)
    const fuelSurchargeVat = fuelSurcharge * vatRate

    // 6. Returns (with free returns deduction)
    const freeReturnsCount = Math.floor(allShipments.length * (config.free_returns_pct / 100))
    const billableReturns = Math.max(0, totalReturns - freeReturnsCount)
    const returnsFee = billableReturns * config.return_fee_eur
    const returnsVat = returnsFee * vatRate

    // Calculate totals
    const subtotalHt = softwareFee + storageFee + receptionFee + shippingTotalEur + fuelSurcharge + returnsFee
    const totalVat = softwareVat + storageVat + receptionVat + shippingVat + fuelSurchargeVat + returnsVat
    const totalTtc = subtotalHt + totalVat

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
          total_eur: shippingTotalEur,
          subtotal_ht: subtotalHt,
          vat_amount: totalVat,
          total_ttc: totalTtc,
          missing_pricing_count: missingPricingCount,
          storage_m3: storage_m3,
          reception_quarters: reception_quarters,
          returns_count: totalReturns,
          free_returns_count: freeReturnsCount,
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
      // Generate invoice number from tenant settings
      const prefix = invoiceSettings.invoice_prefix || 'FAC'
      const nextNum = invoiceSettings.invoice_next_number || 1
      const invoiceNumber = `${prefix}-${year}-${String(nextNum).padStart(3, '0')}`

      // Create new invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices_monthly')
        .insert({
          tenant_id: tenantId,
          month,
          invoice_number: invoiceNumber,
          total_eur: shippingTotalEur,
          subtotal_ht: subtotalHt,
          vat_amount: totalVat,
          total_ttc: totalTtc,
          missing_pricing_count: missingPricingCount,
          storage_m3: storage_m3,
          reception_quarters: reception_quarters,
          returns_count: totalReturns,
          free_returns_count: freeReturnsCount,
          status: 'draft',
        })
        .select('id')
        .single()

      if (invoiceError || !newInvoice) {
        throw invoiceError || new Error('Failed to create invoice')
      }

      invoiceId = newInvoice.id

      // Increment invoice number in tenant settings
      await supabase
        .from('tenant_settings')
        .update({ invoice_next_number: nextNum + 1 })
        .eq('tenant_id', tenantId)
    }

    // Create all invoice lines
    const lines: InvoiceLine[] = []

    // 1. Software line
    lines.push({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      line_type: 'software',
      description: 'Connexion Shopify, notifications de suivi clients, gestion commandes',
      carrier: null,
      weight_min_grams: null,
      weight_max_grams: null,
      shipment_count: 0,
      quantity: 1,
      unit_price_eur: config.software_fee_eur,
      total_eur: softwareFee,
      vat_amount: softwareVat,
    })

    // 2. Storage line (if applicable)
    if (storage_m3 > 0) {
      lines.push({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type: 'storage',
        description: `Stockage & Assurance - Calculé au m³ (${storage_m3} m³)`,
        carrier: null,
        weight_min_grams: null,
        weight_max_grams: null,
        shipment_count: 0,
        quantity: storage_m3,
        unit_price_eur: config.storage_fee_per_m3,
        total_eur: storageFee,
        vat_amount: storageVat,
      })
    }

    // 3. Reception line (if applicable)
    if (reception_quarters > 0) {
      lines.push({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type: 'reception',
        description: `Frais de réception & Contrôle - Calculé au 1/4h (${reception_quarters} x 15min)`,
        carrier: null,
        weight_min_grams: null,
        weight_max_grams: null,
        shipment_count: 0,
        quantity: reception_quarters,
        unit_price_eur: config.reception_fee_per_15min,
        total_eur: receptionFee,
        vat_amount: receptionVat,
      })
    }

    // 4. Shipping lines (by carrier/weight)
    Array.from(shippingGroups.values()).forEach((group) => {
      const weightLabel = group.weight_max_grams >= 1000
        ? `${group.weight_max_grams / 1000}kg`
        : `${group.weight_max_grams}g`

      lines.push({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type: 'shipping',
        description: `Prépa & Expédition - ${group.carrier} ${weightLabel}`,
        carrier: group.carrier,
        weight_min_grams: group.weight_min_grams,
        weight_max_grams: group.weight_max_grams,
        shipment_count: group.shipment_count,
        quantity: group.shipment_count,
        unit_price_eur: group.unit_price_eur,
        total_eur: group.total_eur,
        vat_amount: group.total_eur * vatRate,
      })
    })

    // 5. Fuel surcharge line
    if (fuelSurcharge > 0) {
      lines.push({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type: 'fuel_surcharge',
        description: `Surcharge Carburant CAP - ${config.fuel_surcharge_pct}% du coût Prépa & Expédition`,
        carrier: null,
        weight_min_grams: null,
        weight_max_grams: null,
        shipment_count: 0,
        quantity: config.fuel_surcharge_pct,
        unit_price_eur: shippingTotalEur,
        total_eur: fuelSurcharge,
        vat_amount: fuelSurchargeVat,
      })
    }

    // 6. Returns line (if applicable)
    if (totalReturns > 0) {
      const returnsDescription = freeReturnsCount > 0
        ? `Retour Client - ${freeReturnsCount} offerts (${config.free_returns_pct}%), ${billableReturns} facturés`
        : `Retour Client - ${billableReturns} facturés`

      lines.push({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type: 'returns',
        description: returnsDescription,
        carrier: null,
        weight_min_grams: null,
        weight_max_grams: null,
        shipment_count: totalReturns,
        quantity: billableReturns,
        unit_price_eur: config.return_fee_eur,
        total_eur: returnsFee,
        vat_amount: returnsVat,
      })
    }

    // Insert all lines
    if (lines.length > 0) {
      const { error: linesError } = await supabase.from('invoice_lines').insert(lines)
      if (linesError) {
        console.error('Failed to insert invoice lines:', linesError)
        throw new Error('Erreur lors de la création des lignes de facture')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Facture générée avec succès',
      invoice: {
        id: invoiceId,
        month,
        subtotal_ht: Math.round(subtotalHt * 100) / 100,
        vat_amount: Math.round(totalVat * 100) / 100,
        total_ttc: Math.round(totalTtc * 100) / 100,
        shipment_count: allShipments.length,
        missing_pricing_count: missingPricingCount,
        returns_count: totalReturns,
        free_returns_count: freeReturnsCount,
        line_count: lines.length,
        breakdown: {
          software: softwareFee,
          storage: storageFee,
          reception: receptionFee,
          shipping: shippingTotalEur,
          fuel_surcharge: fuelSurcharge,
          returns: returnsFee,
        },
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
