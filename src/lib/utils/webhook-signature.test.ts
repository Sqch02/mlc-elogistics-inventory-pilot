import { describe, it, expect } from 'vitest'
import {
  validateSignature,
  generateSignature,
  isValidTimestamp,
  isParcelAction,
  PARCEL_ACTIONS,
} from './webhook-signature'

describe('Webhook Signature Validation', () => {
  const TEST_SECRET = 'test-webhook-secret-12345'
  const TEST_PAYLOAD = JSON.stringify({
    action: 'parcel_status_changed',
    timestamp: 1704067200,
    parcel: { id: 12345, tracking_number: 'TRACK123' },
  })

  describe('validateSignature', () => {
    it('should validate correct signature', () => {
      const signature = generateSignature(TEST_PAYLOAD, TEST_SECRET)
      const isValid = validateSignature(TEST_PAYLOAD, signature, TEST_SECRET)

      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', () => {
      const isValid = validateSignature(TEST_PAYLOAD, 'invalid-signature', TEST_SECRET)

      expect(isValid).toBe(false)
    })

    it('should reject modified payload', () => {
      const signature = generateSignature(TEST_PAYLOAD, TEST_SECRET)
      const modifiedPayload = TEST_PAYLOAD.replace('parcel_status_changed', 'parcel_created')

      const isValid = validateSignature(modifiedPayload, signature, TEST_SECRET)

      expect(isValid).toBe(false)
    })

    it('should reject wrong secret', () => {
      const signature = generateSignature(TEST_PAYLOAD, TEST_SECRET)

      const isValid = validateSignature(TEST_PAYLOAD, signature, 'wrong-secret')

      expect(isValid).toBe(false)
    })

    it('should reject empty signature', () => {
      expect(validateSignature(TEST_PAYLOAD, '', TEST_SECRET)).toBe(false)
    })

    it('should reject empty secret', () => {
      const signature = generateSignature(TEST_PAYLOAD, TEST_SECRET)
      expect(validateSignature(TEST_PAYLOAD, signature, '')).toBe(false)
    })

    it('should handle different payload formats', () => {
      const payloads = [
        '{"simple": "json"}',
        '{"nested": {"key": "value"}}',
        '{"array": [1, 2, 3]}',
        'plain text',
        '',
      ]

      for (const payload of payloads) {
        const sig = generateSignature(payload, TEST_SECRET)
        expect(validateSignature(payload, sig, TEST_SECRET)).toBe(true)
      }
    })

    it('should be timing-attack resistant (constant time)', () => {
      const correctSig = generateSignature(TEST_PAYLOAD, TEST_SECRET)

      // These should all take roughly the same time due to constant-time comparison
      // We can't easily test timing, but we can verify the logic works
      expect(validateSignature(TEST_PAYLOAD, correctSig, TEST_SECRET)).toBe(true)
      expect(validateSignature(TEST_PAYLOAD, 'a'.repeat(64), TEST_SECRET)).toBe(false)
      expect(validateSignature(TEST_PAYLOAD, 'b'.repeat(64), TEST_SECRET)).toBe(false)
    })

    it('should reject signature of different length early', () => {
      const signature = generateSignature(TEST_PAYLOAD, TEST_SECRET)

      // Wrong length signatures are rejected immediately
      expect(validateSignature(TEST_PAYLOAD, signature.slice(0, 32), TEST_SECRET)).toBe(false)
      expect(validateSignature(TEST_PAYLOAD, signature + 'extra', TEST_SECRET)).toBe(false)
    })
  })

  describe('generateSignature', () => {
    it('should generate consistent signatures', () => {
      const sig1 = generateSignature(TEST_PAYLOAD, TEST_SECRET)
      const sig2 = generateSignature(TEST_PAYLOAD, TEST_SECRET)

      expect(sig1).toBe(sig2)
    })

    it('should generate different signatures for different payloads', () => {
      const sig1 = generateSignature('payload1', TEST_SECRET)
      const sig2 = generateSignature('payload2', TEST_SECRET)

      expect(sig1).not.toBe(sig2)
    })

    it('should generate different signatures for different secrets', () => {
      const sig1 = generateSignature(TEST_PAYLOAD, 'secret1')
      const sig2 = generateSignature(TEST_PAYLOAD, 'secret2')

      expect(sig1).not.toBe(sig2)
    })

    it('should generate 64-character hex string (SHA256)', () => {
      const sig = generateSignature(TEST_PAYLOAD, TEST_SECRET)

      expect(sig).toHaveLength(64)
      expect(sig).toMatch(/^[a-f0-9]+$/)
    })
  })

  describe('isValidTimestamp', () => {
    it('should accept valid timestamps', () => {
      // Current time (approx 2024-2025)
      expect(isValidTimestamp(1704067200)).toBe(true) // Jan 2024
      expect(isValidTimestamp(1735689600)).toBe(true) // Jan 2025

      // Past valid
      expect(isValidTimestamp(1)).toBe(true) // Jan 1970
      expect(isValidTimestamp(946684800)).toBe(true) // Jan 2000

      // Future valid (up to year 2100)
      expect(isValidTimestamp(4102444799)).toBe(true) // Dec 2099
    })

    it('should reject invalid timestamps', () => {
      expect(isValidTimestamp(0)).toBe(false)
      expect(isValidTimestamp(-1)).toBe(false)
      expect(isValidTimestamp(-1000000)).toBe(false)

      // Too far in future (> year 2100)
      expect(isValidTimestamp(4102444800)).toBe(false)
      expect(isValidTimestamp(9999999999)).toBe(false)
    })
  })

  describe('isParcelAction', () => {
    it('should accept valid parcel actions', () => {
      expect(isParcelAction('parcel_status_changed')).toBe(true)
      expect(isParcelAction('parcel_created')).toBe(true)
      expect(isParcelAction('parcel_cancelled')).toBe(true)
    })

    it('should reject non-parcel actions', () => {
      expect(isParcelAction('integration_updated')).toBe(false)
      expect(isParcelAction('integration_connected')).toBe(false)
      expect(isParcelAction('unknown_action')).toBe(false)
      expect(isParcelAction('')).toBe(false)
    })
  })

  describe('PARCEL_ACTIONS constant', () => {
    it('should contain expected actions', () => {
      expect(PARCEL_ACTIONS).toContain('parcel_status_changed')
      expect(PARCEL_ACTIONS).toContain('parcel_created')
      expect(PARCEL_ACTIONS).toContain('parcel_cancelled')
      expect(PARCEL_ACTIONS).toHaveLength(3)
    })
  })

  describe('Real-world webhook scenarios', () => {
    it('should validate a complete Sendcloud webhook payload', () => {
      const realPayload = JSON.stringify({
        action: 'parcel_status_changed',
        timestamp: 1704067200,
        parcel: {
          id: 123456789,
          name: 'Jean Dupont',
          company_name: '',
          address: '123 Rue de Paris',
          address_2: '',
          house_number: '123',
          city: 'Paris',
          postal_code: '75001',
          country: {
            iso_2: 'FR',
            iso_3: 'FRA',
            name: 'France',
          },
          email: 'jean@example.com',
          telephone: '+33612345678',
          status: {
            id: 11,
            message: 'Delivered',
          },
          tracking_number: 'TRACK123456',
          weight: '0.500',
          carrier: {
            code: 'colissimo',
          },
          order_number: 'ORD-2024-001',
        },
      })

      const secret = 'production-webhook-secret'
      const signature = generateSignature(realPayload, secret)

      expect(validateSignature(realPayload, signature, secret)).toBe(true)
    })

    it('should fail validation if payload is tampered', () => {
      const originalPayload = JSON.stringify({ action: 'parcel_created', parcel: { id: 123 } })
      const secret = 'my-secret'
      const signature = generateSignature(originalPayload, secret)

      // Attacker tries to change the parcel ID
      const tamperedPayload = JSON.stringify({ action: 'parcel_created', parcel: { id: 999 } })

      expect(validateSignature(tamperedPayload, signature, secret)).toBe(false)
    })
  })
})
