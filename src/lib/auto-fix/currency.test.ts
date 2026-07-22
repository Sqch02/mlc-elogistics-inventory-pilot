import { describe, expect, it } from 'vitest'
import type { Json } from '@/types/database'
import type { ChfRateResolution } from './exchange-rate'
import { buildChfToEurConversion } from './currency'

const rate: ChfRateResolution = {
  ok: true,
  rate: {
    baseCurrency: 'CHF',
    targetCurrency: 'EUR',
    rate: '1.080030240847',
    rateDate: '2026-07-21',
    provider: 'ECB',
    providerSeries: 'EXR.D.CHF.EUR.SP00.A',
    providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: '0.9259' },
    fetchedAt: '2026-07-22T08:00:00.000Z',
    expiresAt: '2026-07-23T08:00:00.000Z',
    cacheStatus: 'hit',
  },
}

function readyChange(result: ReturnType<typeof buildChfToEurConversion>) {
  expect(result.ready).toBe(true)
  return result.change as Record<string, unknown>
}

describe('buildChfToEurConversion', () => {
  it('detects line-total values, converts each line and sums target items', () => {
    const change = readyChange(buildChfToEurConversion({
      currency: 'CHF',
      monetary: {
        total_order_value: '10.00',
        parcel_items: [
          { index: 0, quantity: 2, value: '3.33' },
          { index: 1, quantity: 1, value: '6.67' },
        ],
      },
    }, rate))

    expect(change.calculation_status).toBe('ready')
    expect(change.before).toEqual({
      currency: 'CHF', total_order_value: '10.00',
      parcel_items: [{ index: 0, quantity: 2, value: '3.33' }, { index: 1, quantity: 1, value: '6.67' }],
    })
    expect(change.after).toEqual({
      currency: 'EUR', total_order_value: '10.80',
      parcel_items: [{ index: 0, quantity: 2, value: '3.60' }, { index: 1, quantity: 1, value: '7.20' }],
    })
    expect(change.exchange_rate).toMatchObject({
      provider: 'ECB', rate_date: '2026-07-21', rate: '1.080030240847',
      provider_quote: { base_currency: 'EUR', target_currency: 'CHF', rate: '0.9259' },
    })
    expect(change.rounding).toMatchObject({
      decimals: 2,
      mode: 'half_up',
      strategy: 'round_each_item_then_sum',
      item_value_semantics: 'line_total_not_multiplied_by_quantity',
      direct_total_conversion: '10.80',
      item_sum_total: '10.80',
      allocation_delta: '0.00',
    })
  })

  it('detects unit values and includes quantity in both source and target totals', () => {
    const change = readyChange(buildChfToEurConversion({
      currency: 'CHF',
      monetary: {
        total_order_value: '10.00',
        parcel_items: [
          { index: 0, quantity: 2, value: '3.33' },
          { index: 1, quantity: 1, value: '3.34' },
        ],
      },
    }, rate))

    expect(change.after).toEqual({
      currency: 'EUR', total_order_value: '10.81',
      parcel_items: [{ index: 0, quantity: 2, value: '3.60' }, { index: 1, quantity: 1, value: '3.61' }],
    })
    expect(change.rounding).toMatchObject({
      item_value_semantics: 'unit_value_multiplied_by_quantity',
      direct_total_conversion: '10.80',
      item_sum_total: '10.81',
      allocation_delta: '0.01',
    })
  })

  it('uses the sum of rounded lines as the final total and records the delta', () => {
    const highQuote: ChfRateResolution = {
      ...rate,
      rate: {
        ...rate.rate,
        rate: '0.333333333333',
        providerQuote: { ...rate.rate.providerQuote, rate: '3' },
      },
    }
    const change = readyChange(buildChfToEurConversion({
      currency: 'CHF',
      monetary: {
        total_order_value: '0.02',
        parcel_items: [
          { index: 0, quantity: 1, value: '0.01' },
          { index: 1, quantity: 1, value: '0.01' },
        ],
      },
    }, highQuote))

    expect(change.after).toMatchObject({ total_order_value: '0.00' })
    expect(change.rounding).toMatchObject({
      direct_total_conversion: '0.01',
      item_sum_total: '0.00',
      allocation_delta: '-0.01',
      theoretical_max_allocation_delta: '0.01',
      allowed_allocation_delta: '0.01',
    })
    expect(change.consistency).toMatchObject({ allocation_delta_within_tolerance: true })
    expect(change.consistency).not.toHaveProperty('target_total_equals_item_sum')
  })

  it('keeps a materially accumulated rounding delta pending for manual review', () => {
    const highQuote: ChfRateResolution = {
      ...rate,
      rate: {
        ...rate.rate,
        rate: '0.333333333333',
        providerQuote: { ...rate.rate.providerQuote, rate: '3' },
      },
    }
    const result = buildChfToEurConversion({
      currency: 'CHF',
      monetary: {
        total_order_value: '0.05',
        parcel_items: Array.from({ length: 5 }, (_, index) => ({
          index,
          quantity: 1,
          value: '0.01',
        })),
      },
    }, highQuote)

    expect(result.ready).toBe(false)
    if (!result.ready) {
      expect(result.reason).toBe('allocation_delta_exceeds_tolerance')
      expect(result.change).toMatchObject({
        calculation_status: 'pending_manual',
        reason_code: 'allocation_delta_exceeds_tolerance',
        rounding: {
          allocation_delta: '-0.02',
          theoretical_max_allocation_delta: '0.03',
          allowed_allocation_delta: '0.01',
        },
        consistency: { allocation_delta_within_tolerance: false },
      })
    }
  })

  it.each([
    [{ currency: 'EUR', monetary: { total_order_value: '1.00', parcel_items: [{ index: 0, quantity: 1, value: '1.00' }] } }, rate, 'source_currency_unexpected'],
    [{ currency: 'CHF', monetary: { total_order_value: null, parcel_items: [] } }, rate, 'total_missing_or_invalid'],
    [{ currency: 'CHF', monetary: { total_order_value: '1.00', parcel_items: [] } }, rate, 'items_missing'],
    [{ currency: 'CHF', monetary: { total_order_value: '1.00', parcel_items: [{ index: 0, quantity: 1, value: null }] } }, rate, 'item_value_missing_or_invalid'],
    [{ currency: 'CHF', monetary: { total_order_value: '1.00', parcel_items: [{ index: 0, quantity: 0, value: '1.00' }] } }, rate, 'item_quantity_invalid'],
    [{ currency: 'CHF', monetary: { total_order_value: '2.00', parcel_items: [{ index: 0, quantity: 1, value: '1.00' }] } }, rate, 'source_total_items_mismatch'],
    [{ currency: 'CHF', monetary: { total_order_value: '1.00', parcel_items: [{ index: 0, quantity: 1, value: '1.00' }] } }, { ok: false, reason: 'provider_unavailable' }, 'rate_unavailable'],
  ] as const)('keeps an unsafe conversion pending: %s', (summary, resolution, reason) => {
    const result = buildChfToEurConversion(
      summary as unknown as Record<string, Json | undefined>,
      resolution as ChfRateResolution,
    )
    expect(result.ready).toBe(false)
    if (!result.ready) {
      expect(result.reason).toBe(reason)
      expect(result.warning.length).toBeGreaterThan(0)
      expect(result.change).toMatchObject({ calculation_status: 'pending_manual', reason_code: reason })
    }
  })
})
