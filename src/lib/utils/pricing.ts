import { getServerDb } from '@/lib/supabase/untyped'

export interface PricingRule {
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

export interface ShipmentData {
  id: string
  carrier: string
  weight_grams: number
  country_code: string | null
  service_point_id: string | null
}

// Determine destination based on country code and delivery type
export function getDestination(countryCode: string | null, carrier: string, servicePointId: string | null): string {
  if (!countryCode) return 'france_domicile'

  const code = countryCode.toUpperCase()

  // France
  if (code === 'FR' || code === 'MC') {
    // Point relais = relay, sinon domicile
    if (carrier === 'mondial_relay' || servicePointId) {
      return 'france_relay'
    }
    return 'france_domicile'
  }

  // Belgium
  if (code === 'BE') return 'belgique'

  // Switzerland
  if (code === 'CH') return 'suisse'

  // DOM-TOM (French overseas territories)
  const domTom = ['GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'WF', 'PF', 'NC', 'BL', 'MF']
  if (domTom.includes(code)) return 'eu_dom'

  // EU countries
  const euCountries = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO',
    'SK', 'SI', 'ES', 'SE'
  ]
  if (euCountries.includes(code)) return 'eu_dom'

  // World (rest)
  return 'world'
}

export interface ShipmentWithPricing {
  id: string
  sendcloud_id: string
  shipped_at: string
  carrier: string
  weight_grams: number
  pricing_status: 'ok' | 'missing'
  computed_cost_eur: number | null
}

export async function findPricingRule(
  tenantId: string,
  carrier: string,
  weightGrams: number,
  destination: string
): Promise<PricingRule | null> {
  const supabase = await getServerDb()

  const { data } = await supabase
    .from('pricing_rules')
    .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
    .eq('tenant_id', tenantId)
    .ilike('carrier', carrier)
    .eq('destination', destination)
    .lte('weight_min_grams', weightGrams)
    .gt('weight_max_grams', weightGrams)
    .limit(1)
    .single()

  return data as PricingRule | null
}

export async function updateShipmentPricing(
  tenantId: string,
  shipmentId: string
): Promise<{ status: 'ok' | 'missing'; cost: number | null }> {
  const supabase = await getServerDb()

  // Get shipment
  const { data: shipment } = await supabase
    .from('shipments')
    .select('carrier, weight_grams, country_code, service_point_id')
    .eq('id', shipmentId)
    .eq('tenant_id', tenantId)
    .single()

  const shipmentData = shipment as ShipmentData | null

  if (!shipmentData) {
    throw new Error('Shipment not found')
  }

  const destination = getDestination(shipmentData.country_code, shipmentData.carrier, shipmentData.service_point_id)
  const rule = await findPricingRule(tenantId, shipmentData.carrier, shipmentData.weight_grams, destination)

  const status = rule ? 'ok' : 'missing'
  const cost = rule ? Number(rule.price_eur) : null

  // Update shipment
  await supabase
    .from('shipments')
    .update({
      pricing_status: status,
      computed_cost_eur: cost,
    })
    .eq('id', shipmentId)

  return { status, cost }
}

export async function recalculateAllPricing(tenantId: string): Promise<{
  updated: number
  ok: number
  missing: number
}> {
  const supabase = await getServerDb()

  // Get all shipments
  const { data: shipments } = await supabase
    .from('shipments')
    .select('id, carrier, weight_grams, country_code, service_point_id')
    .eq('tenant_id', tenantId)

  const shipmentsList = (shipments as ShipmentData[] | null) || []
  if (shipmentsList.length === 0) return { updated: 0, ok: 0, missing: 0 }

  // Get all pricing rules
  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
    .eq('tenant_id', tenantId)

  const rulesList = (rules as PricingRule[] | null) || []

  let ok = 0
  let missing = 0

  // Batch updates for performance
  const updates: { id: string; pricing_status: 'ok' | 'missing'; computed_cost_eur: number | null }[] = []

  // Calculate pricing for each shipment
  for (const shipment of shipmentsList) {
    const destination = getDestination(shipment.country_code, shipment.carrier, shipment.service_point_id)

    const rule = rulesList.find(
      (r: PricingRule) =>
        r.carrier.toLowerCase() === shipment.carrier.toLowerCase() &&
        r.destination === destination &&
        r.weight_min_grams <= shipment.weight_grams &&
        r.weight_max_grams > shipment.weight_grams
    )

    const status = rule ? 'ok' : 'missing'
    const cost = rule ? Number(rule.price_eur) : null

    updates.push({
      id: shipment.id,
      pricing_status: status,
      computed_cost_eur: cost,
    })

    if (status === 'ok') {
      ok++
    } else {
      missing++
    }
  }

  // Batch update shipments (in chunks of 100)
  const chunkSize = 100
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map((u) =>
        supabase
          .from('shipments')
          .update({
            pricing_status: u.pricing_status,
            computed_cost_eur: u.computed_cost_eur,
          })
          .eq('id', u.id)
      )
    )
  }

  return { updated: shipmentsList.length, ok, missing }
}
