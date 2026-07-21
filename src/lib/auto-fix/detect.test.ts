import { describe, expect, it } from 'vitest'
import { detectAutoFixCause } from './detect'

describe('detectAutoFixCause', () => {
  it('does not infer a cause from On Hold, warnings or CHF data alone', () => {
    expect(detectAutoFixCause({
      shipment_uuid: 'uuid-1',
      order_status: { message: 'On Hold' },
      currency: 'CHF',
      warnings: ['Currency may be unsupported'],
    }, 'integration_shipment')).toBeNull()
  })

  it('does not treat status 1002 as an autonomous pattern', () => {
    expect(detectAutoFixCause({
      id: 42,
      status: { id: 1002, message: 'Announcement failed' },
    }, 'parcel')).toBeNull()
  })

  it('routes a 1002 parcel through its structured CHF cause', () => {
    const result = detectAutoFixCause({
      id: 42,
      status: { id: 1002, message: 'Announcement failed' },
      country: { iso_2: 'CH' },
      total_order_value_currency: 'CHF',
      errors: { non_field_errors: ['La devise CHF n’est pas prise en charge par ce contrat'] },
    }, 'parcel')

    expect(result?.primaryPattern).toBe('currency_chf')
    expect(result?.sourceSummary.status_context).toBe('announcement_failed_1002')
    expect(result?.detectedPatterns).not.toContain('announcement_failed_1002')
  })

  it.each([
    [{ errors: { address_2: ['This field may contain at most 30 characters'] }, address_2: 'x'.repeat(38) }, 'address_too_long'],
    [{ errors: { parcel_items: { 0: { hs_code: ['This field is required'] } } }, parcel_items: [{ weight: '0.2' }] }, 'hs_code_missing'],
    [{ errors: { parcel_items: { 0: { weight: ['Weight must be greater than 0.001 kg'] } } }, parcel_items: [{ weight: '0.0005' }] }, 'weight_too_low'],
    [{ checkout_payload_errors: ['A service point selection is required'], to_service_point: null }, 'service_point_missing'],
    [{ errors: { sender_eori: ['EORI is required'] } }, 'sender_eori_missing'],
  ] as const)('classifies a structured error as %s', (raw, pattern) => {
    expect(detectAutoFixCause(raw, 'integration_shipment')?.detectedPatterns).toContain(pattern)
  })

  it('keeps multiple causes in deterministic priority order in one detection', () => {
    const result = detectAutoFixCause({
      country: 'CH',
      currency: 'CHF',
      address_2: 'x'.repeat(40),
      errors: {
        address_2: ['Address is too long, maximum 30 characters'],
        currency: ['Currency CHF is not supported by contract'],
        sender_eori: ['EORI is required'],
      },
    }, 'integration_shipment')

    expect(result?.detectedPatterns).toEqual([
      'sender_eori_missing',
      'currency_chf',
      'address_too_long',
    ])
    expect(result?.primaryPattern).toBe('sender_eori_missing')
    expect(result?.sourceSummary.address_lengths).toEqual({ address_2: 40 })
  })

  it('creates an unknown review cause only for a real structured error', () => {
    const result = detectAutoFixCause({ errors: { mystery: ['Carrier rejected foo'] } }, 'parcel')
    expect(result?.detectedPatterns).toEqual(['unknown'])
  })

  it('fingerprints error content changes without retaining clear-text evidence', () => {
    const first = detectAutoFixCause({ errors: { address: ['Address too long, max 30 characters'] } }, 'parcel')!
    const second = detectAutoFixCause({ errors: { address: ['Address too long, max 35 characters'] } }, 'parcel')!

    expect(first.sourceFingerprint).not.toBe(second.sourceFingerprint)
    expect(first.evidence[0].messageHash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.evidence[0]).not.toHaveProperty('message')
  })
})
