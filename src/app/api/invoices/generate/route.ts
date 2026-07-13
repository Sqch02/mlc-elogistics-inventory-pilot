import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant, requireRole } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'
import {
  getDestinationZone,
  getDeliveryType,
  formatWeightBracket,
  buildShippingDescription,
} from '@/lib/utils/invoice-calculations'
import { getDestination } from '@/lib/utils/pricing'

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
  country_code: string | null
  service_point_id: string | null
}

interface PricingRule {
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

interface BillingConfig {
  software_fee_eur: number
  storage_fee_per_m3: number
  reception_fee_per_15min: number
  fuel_surcharge_pct: number
  vat_rate_pct: number
  arrivage_billing_mode: 'palette' | 'colis' | 'vrac' | null
  arrivage_palette_price_eur: number | null
  arrivage_box_price_eur: number | null
  arrivage_unit_price_eur: number | null
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
    await requireRole(['super_admin', 'admin', 'ops'])
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const body = await request.json()
    const {
      storage_m3 = 0,
      reception_quarters = 0,
      // Per-month overrides — fall back to tenant_billing_config defaults if absent
      fuel_surcharge_pct: fuelOverride,
      storage_discount_pct: storageDiscountOverride,
    } = body as {
      storage_m3?: number
      reception_quarters?: number
      fuel_surcharge_pct?: number
      storage_discount_pct?: number
      date_from?: string
      date_to?: string
      month?: string
    }

    // Support both: { date_from, date_to } (new) or { month } (legacy)
    let month: string
    if (body.date_from && body.date_to) {
      // Derive month from date_to
      const toDate = new Date(body.date_to)
      month = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}`
    } else if (body.month && /^\d{4}-\d{2}$/.test(body.month)) {
      month = body.month
    } else {
      return NextResponse.json(
        { success: false, message: 'date_from/date_to ou month requis' },
        { status: 400 }
      )
    }

    // Get billing config and tenant settings in parallel (both independent)
    const [{ data: billingConfig }, { data: tenantSettings }] = await Promise.all([
      supabase
        .from('tenant_billing_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('tenant_settings')
        .select('invoice_prefix, invoice_next_number, default_vat_rate')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ])

    const invoiceSettings: TenantSettings = tenantSettings || {
      invoice_prefix: 'FAC',
      invoice_next_number: 1,
      default_vat_rate: 20.00,
    }

    const config: BillingConfig = {
      software_fee_eur: billingConfig?.software_fee_eur ?? 49.00,
      storage_fee_per_m3: billingConfig?.storage_fee_per_m3 ?? 25.00,
      reception_fee_per_15min: billingConfig?.reception_fee_per_15min ?? 30.00,
      // Per-month override wins over tenant default
      fuel_surcharge_pct:
        typeof fuelOverride === 'number' && Number.isFinite(fuelOverride)
          ? fuelOverride
          : (billingConfig?.fuel_surcharge_pct ?? 4.00),
      vat_rate_pct: billingConfig?.vat_rate_pct ?? invoiceSettings.default_vat_rate ?? 20.00,
      arrivage_billing_mode: billingConfig?.arrivage_billing_mode ?? null,
      arrivage_palette_price_eur: billingConfig?.arrivage_palette_price_eur ?? null,
      arrivage_box_price_eur: billingConfig?.arrivage_box_price_eur ?? null,
      arrivage_unit_price_eur: billingConfig?.arrivage_unit_price_eur ?? null,
    }
    // Discount applied to storage line for this invoice (0 by default)
    const storageDiscountPct =
      typeof storageDiscountOverride === 'number' && Number.isFinite(storageDiscountOverride)
        ? Math.max(0, Math.min(100, storageDiscountOverride))
        : 0

    // Parse date range
    const [year, monthNum] = month.split('-').map(Number)
    let startOfMonth: Date
    let endOfMonth: Date

    if (body.date_from && body.date_to) {
      startOfMonth = new Date(body.date_from + 'T00:00:00.000Z')
      endOfMonth = new Date(body.date_to + 'T23:59:59.999Z')
    } else {
      startOfMonth = new Date(year, monthNum - 1, 1)
      endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999)
    }

    // Get all outbound and return shipments in parallel (independent pagination loops)
    const pageSize = 1000

    const [allShipments, returnShipments] = await Promise.all([
      // Outbound shipments
      (async () => {
        const results: Shipment[] = []
        let page = 0
        let hasMore = true
        while (hasMore) {
          const { data: shipmentPage, error: shipmentsError } = await supabase
            .from('shipments')
            .select('id, carrier, weight_grams, pricing_status, computed_cost_eur, status_message, country_code, service_point_id')
            .eq('tenant_id', tenantId)
            .eq('is_return', false)
            .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
            .gte('shipped_at', startOfMonth.toISOString())
            .lte('shipped_at', endOfMonth.toISOString())
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('shipped_at')
          if (shipmentsError) {
            throw shipmentsError
          }
          if (shipmentPage && shipmentPage.length > 0) {
            results.push(...(shipmentPage as Shipment[]))
            hasMore = shipmentPage.length === pageSize
            page++
          } else {
            hasMore = false
          }
        }
        return results
      })(),
      // Return shipments
      (async () => {
        const results: Shipment[] = []
        let page = 0
        let hasMore = true
        while (hasMore) {
          const { data: returnPage, error: returnsError } = await supabase
            .from('shipments')
            .select('id, carrier, weight_grams, pricing_status, computed_cost_eur, status_message, country_code, service_point_id')
            .eq('tenant_id', tenantId)
            .eq('is_return', true)
            .not('status_message', 'in', '("On Hold","Cancelled","Cancelled - customer","Unfulfilled")')
            .gte('shipped_at', startOfMonth.toISOString())
            .lte('shipped_at', endOfMonth.toISOString())
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('shipped_at')
          if (returnsError) {
            throw returnsError
          }
          if (returnPage && returnPage.length > 0) {
            results.push(...(returnPage as Shipment[]))
            hasMore = returnPage.length === pageSize
            page++
          } else {
            hasMore = false
          }
        }
        return results
      })(),
    ])

    const totalReturns = returnShipments.length

    // Get pricing rules for grouping
    const { data: pricingRules } = await supabase
      .from('pricing_rules')
      .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
      .eq('tenant_id', tenantId)
      .order('weight_min_grams', { ascending: true })

    // Group shipments by destination zone + delivery type + weight bracket
    const shippingGroups = new Map<
      string,
      {
        zone: string
        deliveryType: string
        weight_min_grams: number
        weight_max_grams: number
        shipment_count: number
        total_eur: number
        unit_price_eur: number
        description: string
      }
    >()

    let missingPricingCount = 0
    let shippingTotalEur = 0

    // Helper to process a shipment into shipping groups
    function processShipment(shipment: Shipment, isReturn: boolean) {
      if (shipment.pricing_status === 'missing' || shipment.computed_cost_eur == null) {
        missingPricingCount++
        return
      }

      const destination = getDestination(shipment.country_code, shipment.carrier, shipment.service_point_id)

      const rule = (pricingRules as PricingRule[] | null)?.find(
        (r: PricingRule) =>
          r.carrier.toLowerCase() === shipment.carrier.toLowerCase() &&
          r.destination === destination &&
          r.weight_min_grams <= shipment.weight_grams &&
          r.weight_max_grams >= shipment.weight_grams
      )

      const zone = getDestinationZone(shipment.country_code)
      const deliveryType = getDeliveryType(shipment.carrier, shipment.service_point_id)
      const prefix = isReturn ? 'RETOUR|' : ''

      if (rule) {
        // Matched a pricing rule — group by zone/delivery/carrier/weight bracket.
        // Carrier is part of the key so two carriers in the same weight bracket
        // (e.g. Colis Privé @5,91€ vs Colissimo @6,91€ in DOMICILE FR 0-250g)
        // produce two separate invoice lines instead of being averaged together
        // under a single misleading unit price.
        const weightBracket = formatWeightBracket(rule.weight_min_grams, rule.weight_max_grams)
        const carrierKey = (shipment.carrier || 'unknown').toLowerCase()
        const key = `${prefix}${zone}|${deliveryType}|${carrierKey}|${rule.weight_min_grams}|${rule.weight_max_grams}`
        const existing = shippingGroups.get(key)

        const baseDescription = buildShippingDescription(
          zone,
          deliveryType as 'DOMICILE' | 'POINT RELAIS',
          weightBracket,
          shipment.carrier,
        )
        const description = isReturn ? `RETOUR ${baseDescription}` : baseDescription

        if (existing) {
          existing.shipment_count++
          existing.total_eur += Number(shipment.computed_cost_eur)
        } else {
          shippingGroups.set(key, {
            zone,
            deliveryType,
            weight_min_grams: rule.weight_min_grams,
            weight_max_grams: rule.weight_max_grams,
            shipment_count: 1,
            total_eur: Number(shipment.computed_cost_eur),
            unit_price_eur: rule.price_eur,
            description,
          })
        }
      } else {
        // Has computed_cost but no matching rule — group as fallback by carrier
        const carrierName = shipment.carrier || 'inconnu'
        const key = `${prefix}${zone}|${deliveryType}|MISC|${carrierName.toLowerCase()}`
        const existing = shippingGroups.get(key)

        const baseDescription = `${deliveryType} ${zone} ${carrierName} (tarif variable)`
        const description = isReturn ? `RETOUR ${baseDescription}` : baseDescription

        if (existing) {
          existing.shipment_count++
          existing.total_eur += Number(shipment.computed_cost_eur)
        } else {
          shippingGroups.set(key, {
            zone,
            deliveryType,
            weight_min_grams: 0,
            weight_max_grams: 0,
            shipment_count: 1,
            total_eur: Number(shipment.computed_cost_eur),
            unit_price_eur: 0,
            description,
          })
        }
      }

      shippingTotalEur += Number(shipment.computed_cost_eur)
    }

    // Process outbound shipments
    allShipments.forEach((shipment) => processShipment(shipment, false))

    // Process return shipments (same pricing logic, grouped with "RETOUR " prefix)
    returnShipments.forEach((shipment) => processShipment(shipment, true))

    // Calculate all invoice line totals
    const vatRate = config.vat_rate_pct / 100

    // 1. Software fee (fixed monthly)
    const softwareFee = config.software_fee_eur
    const softwareVat = Math.round(softwareFee * vatRate * 100) / 100

    // 2. Storage fee (per m3) — apply optional discount for this invoice
    const storageGross = storage_m3 * config.storage_fee_per_m3
    const storageDiscountAmount = storageGross * (storageDiscountPct / 100)
    const storageFee = Math.round((storageGross - storageDiscountAmount) * 100) / 100
    const storageVat = Math.round(storageFee * vatRate * 100) / 100

    // 3. Reception fee (per 15min quarter)
    const receptionFee = reception_quarters * config.reception_fee_per_15min
    const receptionVat = Math.round(receptionFee * vatRate * 100) / 100

    // 3bis. Reception arrivage: facture les arrivages physiques du mois
    // (inbound_restock acceptes recus dans la fenetre date) selon le mode
    // configure cote tenant_billing_config (palette / colis / vrac).
    // - palette : on compte les arrivages uniques par group_id (chaque ligne
    //   du group_id porte la meme nb_palettes, donc on prend une fois par groupe)
    // - colis   : non implemente cote DB (manque colonne nb_colis) -> reste 0
    // - vrac    : somme des accepted_qty sur les arrivages du mois
    let arrivageFee = 0
    let arrivageQuantity = 0
    let arrivageDescription = ''
    if (config.arrivage_billing_mode) {
      const { data: inbounds } = await supabase
        .from('inbound_restock')
        .select('group_id, nb_palettes, accepted_qty, supplier, received_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'accepted')
        .gte('received_at', startOfMonth.toISOString())
        .lte('received_at', endOfMonth.toISOString())

      const rows = (inbounds || []) as Array<{
        group_id: string | null
        nb_palettes: number | null
        accepted_qty: number | null
        supplier: string | null
      }>

      if (config.arrivage_billing_mode === 'palette') {
        // Dedup par group_id pour ne pas compter 3x les memes palettes
        const seen = new Map<string, { palettes: number; supplier: string | null }>()
        for (const r of rows) {
          const key = r.group_id || `_no_group_${Math.random()}`
          if (!seen.has(key)) {
            seen.set(key, { palettes: r.nb_palettes || 0, supplier: r.supplier })
          }
        }
        arrivageQuantity = Array.from(seen.values()).reduce((s, v) => s + v.palettes, 0)
        const palettePrice = config.arrivage_palette_price_eur ?? 0
        arrivageFee = Math.round(arrivageQuantity * palettePrice * 100) / 100
        const suppliers = Array.from(new Set(Array.from(seen.values()).map(v => v.supplier).filter(Boolean)))
        arrivageDescription = `Réception arrivage palette - ${arrivageQuantity} palettes${suppliers.length ? ' - ' + suppliers.join(', ') : ''}`
      } else if (config.arrivage_billing_mode === 'vrac') {
        arrivageQuantity = rows.reduce((s, r) => s + (r.accepted_qty || 0), 0)
        const unitPrice = config.arrivage_unit_price_eur ?? 0
        arrivageFee = Math.round(arrivageQuantity * unitPrice * 100) / 100
        arrivageDescription = `Réception arrivage vrac - ${arrivageQuantity} unités`
      }
      // 'colis' a implementer quand le schema inbound_restock aura nb_colis
    }
    const arrivageVat = Math.round(arrivageFee * vatRate * 100) / 100

    // 4. Shipping total (already calculated - includes both outbound and returns)
    const shippingVat = shippingTotalEur * vatRate

    // 5. Fuel surcharge (% of total shipping including returns)
    const fuelSurcharge = shippingTotalEur * (config.fuel_surcharge_pct / 100)
    const fuelSurchargeVat = Math.round(fuelSurcharge * vatRate * 100) / 100

    // Calculate totals - round HT first, then compute TVA on rounded HT to avoid floating-point drift
    const subtotalHt = Math.round((softwareFee + storageFee + receptionFee + arrivageFee + shippingTotalEur + fuelSurcharge) * 100) / 100
    const totalVat = Math.round(subtotalHt * vatRate * 100) / 100
    const totalTtc = Math.round((subtotalHt + totalVat) * 100) / 100

    // Check if invoice already exists for this month
    const { data: existingInvoice } = await supabase
      .from('invoices_monthly')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .single()

    let invoiceId: string

    if (existingInvoice) {
      // P0-fact: Re-fetch full status; refuse to overwrite sent/paid invoices.
      // Previously this code silently UPDATEd any existing invoice including
      // ones already sent or paid, and reset status to 'draft'. Violation of
      // French fiscal compliance (emitted invoices must be immutable).
      const { data: fullInvoice } = await supabase
        .from('invoices_monthly')
        .select('id, status, invoice_number')
        .eq('id', existingInvoice.id)
        .single()

      const status = (fullInvoice as { status: string } | null)?.status
      if (status && status !== 'draft') {
        return NextResponse.json(
          {
            error: `La facture ${(fullInvoice as { invoice_number: string }).invoice_number} a deja le statut "${status}". Cree un avoir pour ajuster, ne regenere pas.`,
          },
          { status: 409 }
        )
      }

      // Update existing draft invoice
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
          free_returns_count: 0,
          status: 'draft',
        })
        .eq('id', existingInvoice.id)

      invoiceId = existingInvoice.id

      // Delete existing AUTO-GENERATED lines only. Avoirs/depenses (line_type
      // starting with 'avoir' or 'charge') are saisis manuellement et doivent
      // etre conserves quand on regenere la facture, sinon on les perd a chaque
      // recalcul.
      await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', invoiceId)
        .not('line_type', 'like', 'avoir%')
        .not('line_type', 'like', 'charge%')
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
          free_returns_count: 0,
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
      // Build description matching the historical format the customer expects:
      //   Stockage & Assurance (53m3 x 25€ (20% de remise))
      const storageDescription =
        storageDiscountPct > 0
          ? `Stockage & Assurance (${storage_m3}m3 x ${config.storage_fee_per_m3}€ (${storageDiscountPct}% de remise))`
          : `Stockage & Assurance (${storage_m3}m3 x ${config.storage_fee_per_m3}€)`
      lines.push({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type: 'storage',
        description: storageDescription,
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

    // 3bis. Reception arrivage line (palette / colis / vrac), auto si config tenant set
    if (arrivageFee > 0) {
      const unitPrice =
        config.arrivage_billing_mode === 'palette'
          ? (config.arrivage_palette_price_eur ?? 0)
          : config.arrivage_billing_mode === 'colis'
            ? (config.arrivage_box_price_eur ?? 0)
            : (config.arrivage_unit_price_eur ?? 0)
      lines.push({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type: 'reception_arrivage',
        description: arrivageDescription,
        carrier: null,
        weight_min_grams: null,
        weight_max_grams: null,
        shipment_count: 0,
        quantity: arrivageQuantity,
        unit_price_eur: unitPrice,
        total_eur: arrivageFee,
        vat_amount: arrivageVat,
      })
    }

    // 4. Shipping lines (by zone/delivery type/weight) - includes both outbound and return lines
    // Use the full group key as carrier to guarantee uniqueness per line
    Array.from(shippingGroups.entries()).forEach(([key, group]) => {
      const isReturnLine = key.startsWith('RETOUR|')
      lines.push({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        line_type: isReturnLine ? 'returns' : 'shipping',
        description: group.description,
        carrier: key,
        weight_min_grams: group.weight_min_grams,
        weight_max_grams: group.weight_max_grams,
        shipment_count: group.shipment_count,
        quantity: group.shipment_count,
        unit_price_eur: group.unit_price_eur,
        total_eur: group.total_eur,
        vat_amount: Math.round(group.total_eur * vatRate * 100) / 100,
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

    // Insert all lines
    if (lines.length > 0) {
      const { error: linesError } = await supabase.from('invoice_lines').insert(lines)
      if (linesError) {
        console.error('Failed to insert invoice lines:', linesError)
        // Clean up the invoice if lines fail (avoid orphan invoice with 0 lines)
        await supabase.from('invoices_monthly').delete().eq('id', invoiceId)
        throw new Error(`Erreur lors de la création des lignes de facture: ${linesError.message}`)
      }
    }

    // Calculate returns total from the return shipping lines for the breakdown
    const returnsTotalEur = Array.from(shippingGroups.values())
      .filter(g => g.description.startsWith('RETOUR '))
      .reduce((sum, g) => sum + g.total_eur, 0)

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
        line_count: lines.length,
        breakdown: {
          software: softwareFee,
          storage: storageFee,
          reception: receptionFee,
          shipping: shippingTotalEur - returnsTotalEur,
          fuel_surcharge: fuelSurcharge,
          returns: returnsTotalEur,
        },
      },
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
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
