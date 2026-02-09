/**
 * Pricing matching utilities
 * Extracted for testability
 */

export interface PricingRule {
  id: string
  tenant_id: string
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  unit_price_eur: number
  active: boolean
}

export interface Shipment {
  id: string
  carrier: string
  weight_grams: number
  country_code: string | null
  service_point_id: string | null
}

export interface MatchResult {
  matched: boolean
  rule: PricingRule | null
  price: number | null
  reason: string
}

/**
 * Match a shipment to a pricing rule
 * Rules:
 * 1. Carrier must match (case-insensitive)
 * 2. Weight must be >= min and < max
 * 3. Destination can be specific country, 'relay' for service points, or null for any
 */
export function matchShipmentToRule(
  shipment: Shipment,
  rules: PricingRule[]
): MatchResult {
  if (!shipment.carrier) {
    return {
      matched: false,
      rule: null,
      price: null,
      reason: 'No carrier specified',
    }
  }

  if (shipment.weight_grams <= 0) {
    return {
      matched: false,
      rule: null,
      price: null,
      reason: 'Invalid weight',
    }
  }

  const carrierLower = shipment.carrier.toLowerCase()
  const destination = getDestination(shipment)

  // Find matching rules (active only)
  const matchingRules = rules.filter((rule) => {
    if (!rule.active) return false

    // Carrier must match (case-insensitive)
    if (rule.carrier.toLowerCase() !== carrierLower) return false

    // Weight must be in range [min, max)
    if (shipment.weight_grams < rule.weight_min_grams) return false
    if (shipment.weight_grams >= rule.weight_max_grams) return false

    // Destination matching
    if (rule.destination === null) {
      // Rule applies to all destinations
      return true
    }

    if (rule.destination.toLowerCase() === destination?.toLowerCase()) {
      // Exact destination match (e.g. france_relay === france_relay)
      return true
    }

    return false
  })

  if (matchingRules.length === 0) {
    return {
      matched: false,
      rule: null,
      price: null,
      reason: `No pricing rule for carrier=${shipment.carrier}, weight=${shipment.weight_grams}g, destination=${destination}`,
    }
  }

  // Prefer more specific rules (with destination) over generic ones
  const sortedRules = matchingRules.sort((a, b) => {
    // Rules with destination should come first
    if (a.destination && !b.destination) return -1
    if (!a.destination && b.destination) return 1
    return 0
  })

  const matchedRule = sortedRules[0]

  return {
    matched: true,
    rule: matchedRule,
    price: matchedRule.unit_price_eur,
    reason: 'Matched',
  }
}

/**
 * Map country code to destination identifier matching pricing_rules.destination
 * Pricing rules use: france_relay, france_domicile, belgique, suisse, eu_dom
 */
const COUNTRY_TO_DESTINATION: Record<string, string> = {
  FR: 'france_domicile',
  BE: 'belgique',
  CH: 'suisse',
}

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'DE',
  'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL',
  'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
])

/**
 * Get destination identifier from shipment
 * Maps raw country_code + service_point to pricing rule destination format
 */
export function getDestination(shipment: Shipment): string | null {
  const cc = shipment.country_code?.toUpperCase() || null

  if (shipment.service_point_id) {
    // Relay point delivery
    if (cc === 'FR') return 'france_relay'
    // For other countries with relay, fall through to country mapping
  }

  if (!cc) return null

  // Direct country mapping
  if (COUNTRY_TO_DESTINATION[cc]) return COUNTRY_TO_DESTINATION[cc]

  // EU countries → eu_dom
  if (EU_COUNTRIES.has(cc)) return 'eu_dom'

  // Non-EU international
  return cc
}

/**
 * Validate pricing rule (weight_min < weight_max)
 */
export function isValidPricingRule(rule: Partial<PricingRule>): boolean {
  if (!rule.carrier) return false
  if (typeof rule.weight_min_grams !== 'number') return false
  if (typeof rule.weight_max_grams !== 'number') return false
  if (rule.weight_min_grams < 0) return false
  if (rule.weight_max_grams <= 0) return false
  if (rule.weight_min_grams >= rule.weight_max_grams) return false
  if (typeof rule.unit_price_eur !== 'number' || rule.unit_price_eur < 0) return false
  return true
}

/**
 * Group shipments by carrier and weight tier
 */
export function groupShipmentsByPricing(
  shipments: Array<Shipment & { computed_cost_eur: number }>,
  rules: PricingRule[]
): Map<string, { count: number; total: number; unitPrice: number; carrier: string; weightMin: number; weightMax: number }> {
  const groups = new Map<string, { count: number; total: number; unitPrice: number; carrier: string; weightMin: number; weightMax: number }>()

  for (const shipment of shipments) {
    const match = matchShipmentToRule(shipment, rules)
    if (!match.matched || !match.rule) continue

    const key = `${match.rule.carrier}|${match.rule.weight_min_grams}|${match.rule.weight_max_grams}`
    const existing = groups.get(key)

    if (existing) {
      existing.count++
      existing.total += shipment.computed_cost_eur
    } else {
      groups.set(key, {
        count: 1,
        total: shipment.computed_cost_eur,
        unitPrice: match.rule.unit_price_eur,
        carrier: match.rule.carrier,
        weightMin: match.rule.weight_min_grams,
        weightMax: match.rule.weight_max_grams,
      })
    }
  }

  return groups
}
