import type { Json } from '@/types/database'
import type { ChfRateResolution, ChfToEurRate } from './exchange-rate'

const BIGINT_ZERO = BigInt(0)
const BIGINT_ONE = BigInt(1)
const BIGINT_TWO = BigInt(2)
const BIGINT_TEN = BigInt(10)
const BIGINT_HUNDRED = BigInt(100)
// Future live application must not silently move the order total by more than
// one cent solely to reconcile independently rounded item values.
const MAX_MATERIAL_ALLOCATION_DELTA_CENTS = BigInt(1)

export type CurrencyConversionFailureReason =
  | 'rate_unavailable'
  | 'source_currency_unexpected'
  | 'total_missing_or_invalid'
  | 'items_missing'
  | 'item_value_missing_or_invalid'
  | 'item_quantity_invalid'
  | 'source_total_items_mismatch'
  | 'allocation_delta_exceeds_tolerance'

export type CurrencyConversionPlan =
  | { ready: true; change: Json }
  | { ready: false; reason: CurrencyConversionFailureReason; warning: string; change: Json }

interface MonetaryItem {
  index: number
  quantity: number
  value: string
}

type ItemValueSemantics = 'unit_value_multiplied_by_quantity' | 'line_total_not_multiplied_by_quantity'

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseMinorUnits(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * BIGINT_HUNDRED + BigInt(fraction.padEnd(2, '0'))
}

function formatMinorUnits(value: bigint): string {
  const whole = value / BIGINT_HUNDRED
  const fraction = (value % BIGINT_HUNDRED).toString().padStart(2, '0')
  return `${whole}.${fraction}`
}

function decimalRatio(value: string): { integer: bigint; scale: bigint } | null {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const integer = BigInt(`${whole}${fraction}`)
  return integer > BIGINT_ZERO ? { integer, scale: BIGINT_TEN ** BigInt(fraction.length) } : null
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  return remainder * BIGINT_TWO >= denominator ? quotient + BIGINT_ONE : quotient
}

function convertChfCentsToEur(sourceCents: bigint, rate: ChfToEurRate): bigint | null {
  // The ECB series is quoted as 1 EUR = X CHF. Exact integer arithmetic avoids
  // binary floating-point drift: EUR cents = CHF cents / X, rounded half-up.
  const quote = decimalRatio(rate.providerQuote.rate)
  if (!quote) return null
  return roundHalfUp(sourceCents * quote.scale, quote.integer)
}

function sumItemValues(items: MonetaryItem[], semantics: ItemValueSemantics): bigint {
  return items.reduce((sum, item) => {
    const value = parseMinorUnits(item.value) ?? BIGINT_ZERO
    return sum + (semantics === 'unit_value_multiplied_by_quantity'
      ? value * BigInt(item.quantity)
      : value)
  }, BIGINT_ZERO)
}

function absolute(value: bigint): bigint {
  return value < BIGINT_ZERO ? -value : value
}

function minimum(left: bigint, right: bigint): bigint {
  return left < right ? left : right
}

function theoreticalAllocationDeltaCents(
  items: MonetaryItem[],
  semantics: ItemValueSemantics,
): bigint {
  // Each independently rounded item value contributes at most half a cent of
  // error. For unit values, that error is repeated by quantity when totals are
  // rebuilt. The separately rounded order total adds another half cent.
  const effectiveItemRoundings = semantics === 'unit_value_multiplied_by_quantity'
    ? items.reduce((sum, item) => sum + BigInt(item.quantity), BIGINT_ZERO)
    : BigInt(items.length)
  return (effectiveItemRoundings + BIGINT_ONE) / BIGINT_TWO
}

function unavailable(
  reason: CurrencyConversionFailureReason,
  warning: string,
  details: Record<string, Json | undefined>,
): CurrencyConversionPlan {
  return {
    ready: false,
    reason,
    warning,
    change: {
      pattern: 'currency_chf',
      calculation_status: 'pending_manual',
      reason_code: reason,
      ...details,
    } as Json,
  }
}

function rateAudit(rate: ChfToEurRate): Json {
  return {
    provider: rate.provider,
    series: rate.providerSeries,
    rate_date: rate.rateDate,
    base_currency: rate.baseCurrency,
    target_currency: rate.targetCurrency,
    rate: rate.rate,
    provider_quote: {
      base_currency: rate.providerQuote.baseCurrency,
      target_currency: rate.providerQuote.targetCurrency,
      rate: rate.providerQuote.rate,
    },
    formula: 'EUR = CHF / (CHF per EUR)',
    fetched_at: rate.fetchedAt,
    cache_expires_at: rate.expiresAt,
    cache_status: rate.cacheStatus,
  }
}

export function buildChfToEurConversion(
  sourceSummary: Record<string, Json | undefined>,
  rateResolution: ChfRateResolution | undefined,
): CurrencyConversionPlan {
  if (sourceSummary.currency !== 'CHF') {
    return unavailable(
      'source_currency_unexpected',
      'Devise source inattendue : CHF requis pour calculer la conversion',
      { currency_from: sourceSummary.currency ?? null, currency_to: 'EUR' },
    )
  }
  if (!rateResolution?.ok) {
    return unavailable(
      'rate_unavailable',
      'Taux BCE CHF/EUR indisponible ou non rafraichissable',
      {
        currency_from: 'CHF',
        currency_to: 'EUR',
        rate_unavailable_reason: rateResolution?.reason ?? 'not_resolved',
      },
    )
  }

  const monetary = sourceSummary.monetary
  if (!isObject(monetary)) {
    return unavailable('total_missing_or_invalid', 'Montant total CHF absent ou invalide', {
      currency_from: 'CHF', currency_to: 'EUR', exchange_rate: rateAudit(rateResolution.rate),
    })
  }
  const total = parseMinorUnits(monetary.total_order_value)
  if (total === null) {
    return unavailable('total_missing_or_invalid', 'Montant total CHF absent ou invalide', {
      currency_from: 'CHF', currency_to: 'EUR', exchange_rate: rateAudit(rateResolution.rate),
    })
  }
  if (!Array.isArray(monetary.parcel_items) || monetary.parcel_items.length === 0) {
    return unavailable('items_missing', 'Aucun item valorise disponible pour controler le total', {
      currency_from: 'CHF', currency_to: 'EUR', exchange_rate: rateAudit(rateResolution.rate),
    })
  }

  const items: MonetaryItem[] = []
  for (const [position, rawItem] of monetary.parcel_items.entries()) {
    if (!isObject(rawItem) || !Number.isInteger(rawItem.index) || Number(rawItem.index) < 0 || parseMinorUnits(rawItem.value) === null) {
      return unavailable('item_value_missing_or_invalid', `Valeur CHF invalide pour l'item ${position + 1}`, {
        currency_from: 'CHF', currency_to: 'EUR', exchange_rate: rateAudit(rateResolution.rate), item_index: position,
      })
    }
    if (!Number.isInteger(rawItem.quantity) || Number(rawItem.quantity) < 1) {
      return unavailable('item_quantity_invalid', `Quantite invalide pour l'item ${position + 1}`, {
        currency_from: 'CHF', currency_to: 'EUR', exchange_rate: rateAudit(rateResolution.rate), item_index: position,
      })
    }
    items.push({ index: Number(rawItem.index), quantity: Number(rawItem.quantity), value: String(rawItem.value) })
  }

  const sourceUnitValueTotal = sumItemValues(items, 'unit_value_multiplied_by_quantity')
  const sourceLineValueTotal = sumItemValues(items, 'line_total_not_multiplied_by_quantity')
  const itemValueSemantics: ItemValueSemantics | null = sourceUnitValueTotal === total
    ? 'unit_value_multiplied_by_quantity'
    : sourceLineValueTotal === total
      ? 'line_total_not_multiplied_by_quantity'
      : null
  if (!itemValueSemantics) {
    return unavailable('source_total_items_mismatch', 'Le total CHF ne correspond pas a la somme des valeurs des items', {
      currency_from: 'CHF',
      currency_to: 'EUR',
      source_total_order_value: formatMinorUnits(total),
      source_unit_values_times_quantity_total: formatMinorUnits(sourceUnitValueTotal),
      source_line_values_total: formatMinorUnits(sourceLineValueTotal),
      exchange_rate: rateAudit(rateResolution.rate),
    })
  }

  const targetItems = items.map((item) => {
    const sourceValue = parseMinorUnits(item.value) ?? BIGINT_ZERO
    const converted = convertChfCentsToEur(sourceValue, rateResolution.rate)
    return converted === null ? null : {
      index: item.index,
      quantity: item.quantity,
      value: formatMinorUnits(converted),
    }
  })
  if (targetItems.some((item) => item === null)) {
    return unavailable('rate_unavailable', 'Cotation BCE invalide pour le calcul monetaire', {
      currency_from: 'CHF', currency_to: 'EUR', exchange_rate: rateAudit(rateResolution.rate),
    })
  }
  const safeTargetItems = targetItems as Array<{ index: number; quantity: number; value: string }>
  const targetTotal = sumItemValues(safeTargetItems, itemValueSemantics)
  const directTargetTotal = convertChfCentsToEur(total, rateResolution.rate)
  if (directTargetTotal === null) {
    return unavailable('rate_unavailable', 'Cotation BCE invalide pour le calcul monetaire', {
      currency_from: 'CHF', currency_to: 'EUR', exchange_rate: rateAudit(rateResolution.rate),
    })
  }
  const delta = targetTotal - directTargetTotal

  const theoreticalMaxDelta = theoreticalAllocationDeltaCents(items, itemValueSemantics)
  const allowedDelta = minimum(theoreticalMaxDelta, MAX_MATERIAL_ALLOCATION_DELTA_CENTS)
  const deltaWithinTolerance = absolute(delta) <= allowedDelta
  const conversionDetails = {
    pattern: 'currency_chf',
    calculation_status: deltaWithinTolerance ? 'ready' : 'pending_manual',
    ...(!deltaWithinTolerance ? { reason_code: 'allocation_delta_exceeds_tolerance' } : {}),
    before: {
      currency: 'CHF',
      total_order_value: formatMinorUnits(total),
      parcel_items: items,
    },
    after: {
      currency: 'EUR',
      total_order_value: formatMinorUnits(targetTotal),
      parcel_items: safeTargetItems,
    },
    exchange_rate: rateAudit(rateResolution.rate),
    rounding: {
      decimals: 2,
      mode: 'half_up',
      strategy: 'round_each_item_then_sum',
      item_value_semantics: itemValueSemantics,
      direct_total_conversion: formatMinorUnits(directTargetTotal),
      item_sum_total: formatMinorUnits(targetTotal),
      allocation_delta: `${delta < BIGINT_ZERO ? '-' : ''}${formatMinorUnits(absolute(delta))}`,
      theoretical_max_allocation_delta: formatMinorUnits(theoreticalMaxDelta),
      allowed_allocation_delta: formatMinorUnits(allowedDelta),
    },
    consistency: {
      source_total_equals_item_sum: true,
      allocation_delta_within_tolerance: deltaWithinTolerance,
    },
  }

  if (!deltaWithinTolerance) {
    return {
      ready: false,
      reason: 'allocation_delta_exceeds_tolerance',
      warning: 'Ecart cumule des arrondis superieur a la tolerance monetaire',
      change: conversionDetails as unknown as Json,
    }
  }

  return {
    ready: true,
    change: conversionDetails as unknown as Json,
  }
}
