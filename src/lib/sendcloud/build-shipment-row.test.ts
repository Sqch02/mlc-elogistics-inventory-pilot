import { describe, expect, it } from 'vitest'
import type { ParsedShipment } from '@/lib/sendcloud/types'
import type { PricingRule } from '@/lib/utils/pricing'
import { buildShipmentRow } from './build-shipment-row'

const parcel: ParsedShipment = {
  sendcloud_id: '123456',
  shipped_at: '2026-07-13T08:00:00.000Z',
  carrier: 'Colissimo',
  service: 'Domicile',
  weight_grams: 500,
  order_ref: 'ORDER-42',
  tracking: 'TRACK-42',
  raw_json: { id: 123456 },
  recipient_name: 'Ada Lovelace',
  recipient_email: 'ada@example.com',
  recipient_phone: '+33123456789',
  recipient_company: 'Analytical Engines',
  address_line1: '10 rue du Test',
  address_line2: 'Bâtiment A',
  house_number: '10',
  city: 'Paris',
  postal_code: '75001',
  country_code: 'FR',
  country_name: 'France',
  status_id: 11,
  status_message: 'Ready to send',
  tracking_url: 'https://tracking.example/42',
  label_url: 'https://labels.example/42.pdf',
  total_value: 49.9,
  currency: 'EUR',
  service_point_id: null,
  is_return: false,
  collo_count: 1,
  length_cm: 30,
  width_cm: 20,
  height_cm: 10,
  external_order_id: 'external-42',
  date_created: '2026-07-13T07:00:00.000Z',
  date_updated: '2026-07-13T07:30:00.000Z',
  date_announced: '2026-07-13T07:45:00.000Z',
  has_error: false,
  error_message: null,
}

const pricingRules: PricingRule[] = [
  {
    carrier: 'colissimo',
    destination: 'france_domicile',
    weight_min_grams: 0,
    weight_max_grams: 500,
    price_eur: 4.9,
  },
  {
    carrier: 'Colissimo',
    destination: 'france_domicile',
    weight_min_grams: 500,
    weight_max_grams: 1000,
    price_eur: 6.9,
  },
]

describe('buildShipmentRow', () => {
  it('maps every Sendcloud field and calculates pricing', () => {
    const row = buildShipmentRow('tenant-1', parcel, pricingRules)

    expect(row).toEqual({
      tenant_id: 'tenant-1',
      sendcloud_id: '123456',
      shipped_at: '2026-07-13T08:00:00.000Z',
      carrier: 'Colissimo',
      service: 'Domicile',
      weight_grams: 500,
      order_ref: 'ORDER-42',
      tracking: 'TRACK-42',
      pricing_status: 'ok',
      computed_cost_eur: 4.9,
      raw_json: { id: 123456 },
      recipient_name: 'Ada Lovelace',
      recipient_email: 'ada@example.com',
      recipient_phone: '+33123456789',
      recipient_company: 'Analytical Engines',
      address_line1: '10 rue du Test',
      address_line2: 'Bâtiment A',
      house_number: '10',
      city: 'Paris',
      postal_code: '75001',
      country_code: 'FR',
      country_name: 'France',
      status_id: 11,
      status_message: 'Ready to send',
      tracking_url: 'https://tracking.example/42',
      label_url: 'https://labels.example/42.pdf',
      total_value: 49.9,
      currency: 'EUR',
      service_point_id: null,
      is_return: false,
      collo_count: 1,
      length_cm: 30,
      width_cm: 20,
      height_cm: 10,
      external_order_id: 'external-42',
      date_created: '2026-07-13T07:00:00.000Z',
      date_updated: '2026-07-13T07:30:00.000Z',
      date_announced: '2026-07-13T07:45:00.000Z',
      has_error: false,
      error_message: null,
    })
    expect(row).not.toHaveProperty('status')
  })

  it('preserves rule order when inclusive brackets overlap', () => {
    expect(buildShipmentRow('tenant-1', parcel, pricingRules).computed_cost_eur).toBe(4.9)
  })

  it('uses relay destination pricing when a service point is present', () => {
    const relayParcel = { ...parcel, service_point_id: 'point-1' }
    const relayRule: PricingRule = {
      ...pricingRules[0],
      destination: 'france_relay',
      price_eur: 3.5,
    }

    expect(buildShipmentRow('tenant-1', relayParcel, [relayRule])).toMatchObject({
      pricing_status: 'ok',
      computed_cost_eur: 3.5,
    })
  })

  it.each([null, [], [{ ...pricingRules[0], carrier: 'Chronopost' }]])(
    'marks pricing as missing when no rule matches (%j)',
    (rules) => {
      expect(buildShipmentRow('tenant-1', parcel, rules)).toMatchObject({
        pricing_status: 'missing',
        computed_cost_eur: null,
      })
    },
  )
})
