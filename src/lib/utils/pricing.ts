export interface PricingRule {
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

// Detect if shipment is a relay (point relais) delivery
function isRelay(carrier: string, servicePointId: string | null): boolean {
  const c = carrier.toLowerCase()
  // mondial_relay is always relay
  if (c === 'mondial_relay') return true
  // If service_point_id is set, it's relay
  if (servicePointId) return true
  return false
}

const DOM_TOM = new Set(['GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'WF', 'PF', 'NC', 'BL', 'MF'])

const EU_COUNTRIES = new Set([
  'AT', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SK', 'SI', 'ES', 'SE',
])

// Determine destination based on country code and delivery type
export function getDestination(countryCode: string | null, carrier: string, servicePointId: string | null): string {
  if (!countryCode) return 'france_domicile'

  const code = countryCode.toUpperCase()
  const relay = isRelay(carrier, servicePointId)

  // France (+ Monaco)
  if (code === 'FR' || code === 'MC') {
    return relay ? 'france_relay' : 'france_domicile'
  }

  // Belgium
  if (code === 'BE') {
    return relay ? 'relay_be' : 'domicile_be'
  }

  // Luxembourg
  if (code === 'LU') {
    return relay ? 'relay_lux' : 'domicile_lux'
  }

  // Switzerland
  if (code === 'CH') return 'domicile_suisse'

  // DOM-TOM (French overseas territories)
  if (DOM_TOM.has(code)) {
    return relay ? 'relay_eu_dom' : 'domicile_ue_dom'
  }

  // EU countries
  if (EU_COUNTRIES.has(code)) {
    return relay ? 'relay_eu_dom' : 'domicile_ue_dom'
  }

  // World (rest)
  return 'domicile_world'
}
