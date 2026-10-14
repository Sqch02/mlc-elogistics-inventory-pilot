import { describe, expect, it } from 'vitest'
import { getDestination, isSameCarrier } from './pricing'

describe('getDestination used by Sendcloud sync', () => {
  it.each([
    { country: 'FR', carrier: 'colissimo', point: null, expected: 'france_domicile' },
    { country: 'MC', carrier: 'colissimo', point: 'P-1', expected: 'france_relay' },
    { country: 'BE', carrier: 'colissimo', point: null, expected: 'domicile_be' },
    { country: 'BE', carrier: 'colissimo', point: 'P-2', expected: 'relay_be' },
    { country: 'LU', carrier: 'colissimo', point: null, expected: 'domicile_lux' },
    { country: 'CH', carrier: 'colissimo', point: 'P-3', expected: 'domicile_suisse' },
    { country: 'DE', carrier: 'dhl', point: null, expected: 'domicile_ue_dom' },
    { country: 'RE', carrier: 'colissimo', point: 'P-4', expected: 'relay_eu_dom' },
    { country: 'US', carrier: 'dhl', point: null, expected: 'domicile_world' },
    { country: 'FR', carrier: 'mondial_relay', point: null, expected: 'france_relay' },
  ])(
    'maps $country/$carrier/$point to $expected',
    ({ country, carrier, point, expected }) => {
      expect(getDestination(country, carrier, point)).toBe(expected)
    },
  )

  it('uses the France home-delivery fallback when Sendcloud omits the country', () => {
    expect(getDestination(null, 'colissimo', null)).toBe('france_domicile')
  })

  it('normalizes lower-case country codes', () => {
    expect(getDestination('be', 'colissimo', null)).toBe('domicile_be')
  })
})

describe('isSameCarrier', () => {
  // The pricing screen suggests display names and saves them upper-cased,
  // while parcels carry Sendcloud's carrier code.
  it.each([
    ['COLIS PRIVÉ', 'colisprive'],
    ['Colis Privé', 'colisprive'],
    ['COLISPRIVE', 'colisprive'],
    ['MONDIAL RELAY', 'mondial_relay'],
    ['MONDIAL_RELAY', 'mondial_relay'],
    ['CHRONOPOST', 'chronopost'],
  ])('matches the rule carrier %s to the parcel carrier %s', (rule, parcel) => {
    expect(isSameCarrier(rule, parcel)).toBe(true)
  })

  it.each([
    ['COLISSIMO', 'colisprive'],
    ['DHL', 'dhl_express'],
  ])('keeps %s and %s apart', (rule, parcel) => {
    expect(isSameCarrier(rule, parcel)).toBe(false)
  })
})
