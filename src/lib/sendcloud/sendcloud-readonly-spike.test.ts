import { describe, expect, it } from 'vitest'
import {
  anonymizeJson,
  assertReadOnlyUrl,
  classifyIntegrationShipment,
  classifyParcel,
  parseCliOptions,
} from '../../../scripts/sendcloud-readonly-spike'

describe('sendcloud readonly spike', () => {
  it('refuse les hotes qui ne sont pas explicitement autorises', () => {
    expect(() => assertReadOnlyUrl('https://example.com/api/v2/parcels')).toThrow('non autorise')
    expect(assertReadOnlyUrl('https://panel.sendcloud.sc/api/v2/parcels').hostname).toBe('panel.sendcloud.sc')
  })

  it('borne les volumes de lecture', () => {
    expect(() => parseCliOptions(['--max-pages-per-integration', '4'])).toThrow('limite a 3')
    expect(() => parseCliOptions(['--max-parcel-pages', '11'])).toThrow('limite a 10')
    expect(() => parseCliOptions(['--page-size', '101'])).toThrow('limite a 100')
    expect(() => parseCliOptions(['--probe-service-points', 'yes'])).toThrow('true ou false')
    expect(parseCliOptions(['--probe-service-points', 'true']).probeServicePoints).toBe(true)
  })

  it('anonymise les donnees personnelles et identifiants sans perdre la structure', () => {
    const result = anonymizeJson({
      shipment_uuid: '11111111-1111-1111-1111-111111111111',
      name: 'Alice Martin',
      email: 'alice@example.com',
      country: 'FR',
      errors: { address: ['alice@example.com: has at most 30 characters'] },
      parcel_items: [{ sku: 'SECRET-SKU', properties: { engraving: 'Alice' }, weight: '0.0005', hs_code: null }],
    }, 'test-salt') as Record<string, unknown>

    expect(result.shipment_uuid).toMatch(/^\[ID:/)
    expect(result.name).toBe('[REDACTED len=12]')
    expect(result.email).toBe('[REDACTED len=17]')
    expect(result.country).toBe('FR')
    expect(JSON.stringify(result)).not.toContain('alice@example.com')
    expect(JSON.stringify(result)).not.toContain('SECRET-SKU')
    expect(JSON.stringify(result)).not.toContain('Alice')
    expect(JSON.stringify(result)).toContain('has at most 30 characters')
  })

  it('distingue les erreurs API des heuristiques', () => {
    const matches = classifyIntegrationShipment({
      currency: 'CHF',
      country: 'CH',
      errors: { address: ['Ensure this field has at most 30 characters.'] },
      shipping_method_checkout_name: 'Mondial Relay Point Relais',
      to_service_point: null,
      parcel_items: [{ weight: '0.0005', hs_code: null, origin_country: null }],
    })

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ pattern: 'currency_chf', kind: 'data_heuristic' }),
      expect.objectContaining({ pattern: 'address_too_long', kind: 'api_error' }),
      expect.objectContaining({ pattern: 'hs_code_missing', kind: 'data_heuristic' }),
      expect.objectContaining({ pattern: 'weight_too_low', kind: 'data_heuristic' }),
      expect.objectContaining({ pattern: 'service_point_missing', kind: 'data_heuristic' }),
    ]))
  })

  it('ne confond pas un contrat invalide en EUR avec une erreur CHF', () => {
    expect(classifyIntegrationShipment({
      currency: 'EUR',
      country: 'DE',
      errors: { contract: ['Contract is not valid.'] },
    })).toEqual([])

    expect(classifyIntegrationShipment({
      currency: 'CHF',
      country: 'CH',
      errors: { contract: ['Contract is not valid.'] },
    })).toEqual([
      expect.objectContaining({ pattern: 'currency_chf', kind: 'api_error' }),
    ])
  })

  it('reconnait le libelle francais reel de longueur adresse', () => {
    expect(classifyParcel({
      status: { id: 1002, message: 'Announcement failed' },
      errors: { address_add2: ["La deuxième ligne d'adresse dépasse 30 caractères ; veuillez la raccourcir."] },
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ pattern: 'address_too_long', kind: 'api_error' }),
    ]))
  })

  it('classe 1002 uniquement depuis le statut parcel', () => {
    expect(classifyParcel({ status: { id: 1002, message: 'Announcement failed' } })).toEqual([
      expect.objectContaining({ pattern: 'announcement_failed_1002', kind: 'parcel_status' }),
    ])
    expect(classifyParcel({ status: { id: 11, message: 'Delivered' } })).toEqual([])
  })

  it('ne traite comme douane manquante que les destinations hors UE', () => {
    expect(classifyIntegrationShipment({
      country: 'FR',
      parcel_items: [{ hs_code: null, origin_country: null }],
    })).toEqual([])
    expect(classifyIntegrationShipment({
      country: { iso_2: 'CH' },
      parcel_items: [{ hs_code: null, origin_country: null }],
    })).toEqual([
      expect.objectContaining({ pattern: 'hs_code_missing', kind: 'data_heuristic' }),
    ])
  })
})
