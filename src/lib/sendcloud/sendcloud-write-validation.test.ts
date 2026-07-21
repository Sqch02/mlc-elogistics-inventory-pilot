import { describe, expect, it } from 'vitest'
import {
  accountFingerprint,
  approvalTokenForManifest,
  assertWriteGate,
  computePlanHash,
  hashJson,
  parseCliOptions,
  TEST_ACCOUNT_FINGERPRINT_ENV,
  validateDisposablePayload,
  validatePatch,
  ValidationManifest,
  WRITE_VALIDATION_ENV,
} from '../../../scripts/sendcloud-write-validation'

function manifest(apiKey: string): ValidationManifest {
  const now = new Date().toISOString()
  const value: ValidationManifest = {
    version: 1,
    operation: 'v2_update_documented',
    state: 'planned',
    created_at: now,
    updated_at: now,
    account_fingerprint: accountFingerprint(apiKey),
    target: {
      kind: 'v2_parcel',
      id: '123',
      marker_hash: 'marker',
    },
    before: { id: 123, order_number: 'MLC-AUTOFIX-TEST-001' },
    before_hash: 'before',
    request: {
      method: 'PUT',
      path: '/api/v2/parcels',
      body: { parcel: { id: 123, address_2: 'TEST' } },
    },
    rollback: {
      kind: 'request',
      request: {
        method: 'PUT',
        path: '/api/v2/parcels',
        body: { parcel: { id: 123, address_2: null } },
      },
    },
    plan_hash: '',
    approval_token: '',
    rollback_token: 'ROLLBACK:test',
  }
  value.plan_hash = computePlanHash(value)
  value.approval_token = approvalTokenForManifest(value)
  return value
}

describe('Sendcloud write validation harness', () => {
  it('parse une commande sans accepter d argument positionnel implicite', () => {
    const parsed = parseCliOptions([
      'prepare-v2-update',
      '--parcel-id', '123',
      '--contract=documented',
    ])
    expect(parsed.command).toBe('prepare-v2-update')
    expect(parsed.values.get('parcel-id')).toBe('123')
    expect(parsed.values.get('contract')).toBe('documented')
    expect(() => parseCliOptions(['execute', 'manifest.json'])).toThrow('Argument inattendu')
  })

  it('calcule un hash stable quel que soit l ordre des cles', () => {
    expect(hashJson({ b: 2, a: 1 })).toBe(hashJson({ a: 1, b: 2 }))
  })

  it('limite les patchs aux champs metier explicitement autorises', () => {
    expect(() => validatePatch('v2_update_documented', { address_2: 'TEST' })).not.toThrow()
    expect(() => validatePatch('v2_update_documented', { request_label: true })).toThrow('non autorise')
    expect(() => validatePatch('v3_patch_order', {
      shipping_address: { address_line_2: 'TEST' },
    })).not.toThrow()
    expect(() => validatePatch('v2_update_documented', {
      shipment: { id: 123 },
      to_service_point: 456,
    })).not.toThrow()
    expect(() => validatePatch('v3_patch_order', {
      service_point_details: { id: 456 },
    })).not.toThrow()
    expect(() => validatePatch('v3_patch_order', {
      order_details: { status: { code: 'fulfilled' } },
    })).toThrow('Champ interdit')
  })

  it('n accepte qu un colis jetable non annonce et impossible a mapper par identifiants usuels', () => {
    const marker = 'MLC-AUTOFIX-TEST-20260721-001'
    const payload = {
      name: 'MLC AUTOFIX TEST',
      address: '1 rue de Test',
      city: 'Paris',
      postal_code: '75001',
      country: 'FR',
      weight: '0.100',
      order_number: marker,
      request_label: false,
      parcel_items: [{
        sku: 'MLC-AUTOFIX-NO-SKU-A8F3C91D',
        description: 'ZZQXVJK-A8F3C91D',
        quantity: 1,
        weight: '0.100',
        value: '1.00',
      }],
    }

    expect(validateDisposablePayload(payload)).toBe(marker)
    expect(() => validateDisposablePayload({ ...payload, request_label: true })).toThrow('request_label=false')
    expect(() => validateDisposablePayload({ ...payload, telephone: '+33123456789' })).toThrow('ni email ni telephone')
    expect(() => validateDisposablePayload({
      ...payload,
      parcel_items: [{ ...payload.parcel_items[0], sku: 'REAL-SKU' }],
    })).toThrow('MLC-AUTOFIX-NO-SKU-')
    expect(() => validateDisposablePayload({
      ...payload,
      parcel_items: [{ ...payload.parcel_items[0], description: 'Produit test' }],
    })).toThrow('ZZQXVJK-')
    expect(() => validateDisposablePayload({ ...payload, shipment_uuid: '00000000-0000-0000-0000-000000000000' })).toThrow('Champ interdit')
  })

  it('refuse tout write sans les quatre verrous concordants', () => {
    const apiKey = 'test-key'
    const value = manifest(apiKey)
    const flags = new Map([
      ['allow-write', 'I_UNDERSTAND_ONE_TEST_OBJECT'],
      ['approval-token', value.approval_token],
    ])
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      [WRITE_VALIDATION_ENV]: 'true',
      [TEST_ACCOUNT_FINGERPRINT_ENV]: accountFingerprint(apiKey),
    }

    expect(() => assertWriteGate(value, 'execute', flags, env, apiKey)).not.toThrow()
    expect(() => assertWriteGate(value, 'execute', flags, { ...env, NODE_ENV: 'production' }, apiKey)).toThrow('production')
    expect(() => assertWriteGate(value, 'execute', flags, { ...env, [WRITE_VALIDATION_ENV]: 'false' }, apiKey)).toThrow(WRITE_VALIDATION_ENV)
    expect(() => assertWriteGate(value, 'execute', new Map(), env, apiKey)).toThrow('allow-write')
    expect(() => assertWriteGate(value, 'execute', flags, env, 'wrong-key')).toThrow(TEST_ACCOUNT_FINGERPRINT_ENV)

    value.request.path = '/api/v2/parcels/999'
    expect(() => assertWriteGate(value, 'execute', flags, env, apiKey)).toThrow('modifie')
  })

  it('utilise un verrou distinct pour le rollback', () => {
    const apiKey = 'test-key'
    const value = manifest(apiKey)
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      [WRITE_VALIDATION_ENV]: 'true',
      [TEST_ACCOUNT_FINGERPRINT_ENV]: accountFingerprint(apiKey),
    }
    const flags = new Map([
      ['allow-rollback', 'I_UNDERSTAND_ONE_TEST_OBJECT'],
      ['approval-token', value.rollback_token!],
    ])
    expect(() => assertWriteGate(value, 'rollback', flags, env, apiKey)).not.toThrow()
    flags.set('approval-token', value.approval_token)
    expect(() => assertWriteGate(value, 'rollback', flags, env, apiKey)).toThrow('Approval token')
  })
})
