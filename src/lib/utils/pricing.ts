import { getServerDb } from '@/lib/supabase/untyped'

export interface PricingRule {
  carrier: string
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

export interface ShipmentData {
  id: string
  carrier: string
  weight_grams: number
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
  weightGrams: number
): Promise<PricingRule | null> {
  const supabase = await getServerDb()

  const { data } = await supabase
    .from('pricing_rules')
    .select('carrier, weight_min_grams, weight_max_grams, price_eur')
    .eq('tenant_id', tenantId)
    .ilike('carrier', carrier)
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
    .select('carrier, weight_grams')
    .eq('id', shipmentId)
    .eq('tenant_id', tenantId)
    .single()

  const shipmentData = shipment as ShipmentData | null

  if (!shipmentData) {
    throw new Error('Shipment not found')
  }

  const rule = await findPricingRule(tenantId, shipmentData.carrier, shipmentData.weight_grams)

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
    .select('id, carrier, weight_grams')
    .eq('tenant_id', tenantId)

  const shipmentsList = (shipments as ShipmentData[] | null) || []
  if (shipmentsList.length === 0) return { updated: 0, ok: 0, missing: 0 }

  // Get all pricing rules
  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('carrier, weight_min_grams, weight_max_grams, price_eur')
    .eq('tenant_id', tenantId)

  const rulesList = (rules as PricingRule[] | null) || []

  let ok = 0
  let missing = 0

  // Update each shipment
  for (const shipment of shipmentsList) {
    const rule = rulesList.find(
      (r: PricingRule) =>
        r.carrier.toLowerCase() === shipment.carrier.toLowerCase() &&
        r.weight_min_grams <= shipment.weight_grams &&
        r.weight_max_grams > shipment.weight_grams
    )

    const status = rule ? 'ok' : 'missing'
    const cost = rule ? Number(rule.price_eur) : null

    await supabase
      .from('shipments')
      .update({
        pricing_status: status,
        computed_cost_eur: cost,
      })
      .eq('id', shipment.id)

    if (status === 'ok') {
      ok++
    } else {
      missing++
    }
  }

  return { updated: shipmentsList.length, ok, missing }
}
