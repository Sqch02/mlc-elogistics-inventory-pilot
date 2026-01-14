import { describe, it, expect } from 'vitest'
import {
  matchShipmentToRule,
  getDestination,
  isValidPricingRule,
  groupShipmentsByPricing,
  type PricingRule,
  type Shipment,
} from './pricing-matcher'

describe('Pricing Matcher', () => {
  const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001'

  const sampleRules: PricingRule[] = [
    {
      id: '1',
      tenant_id: TEST_TENANT_ID,
      carrier: 'colissimo',
      destination: 'FR',
      weight_min_grams: 0,
      weight_max_grams: 500,
      unit_price_eur: 5.37,
      active: true,
    },
    {
      id: '2',
      tenant_id: TEST_TENANT_ID,
      carrier: 'colissimo',
      destination: 'FR',
      weight_min_grams: 500,
      weight_max_grams: 1000,
      unit_price_eur: 6.18,
      active: true,
    },
    {
      id: '3',
      tenant_id: TEST_TENANT_ID,
      carrier: 'mondial_relay',
      destination: 'relay',
      weight_min_grams: 0,
      weight_max_grams: 500,
      unit_price_eur: 5.88,
      active: true,
    },
    {
      id: '4',
      tenant_id: TEST_TENANT_ID,
      carrier: 'dhl',
      destination: null, // Any destination
      weight_min_grams: 0,
      weight_max_grams: 1000,
      unit_price_eur: 12.00,
      active: true,
    },
    {
      id: '5',
      tenant_id: TEST_TENANT_ID,
      carrier: 'inactive_carrier',
      destination: 'FR',
      weight_min_grams: 0,
      weight_max_grams: 500,
      unit_price_eur: 10.00,
      active: false, // Inactive rule
    },
  ]

  describe('matchShipmentToRule', () => {
    it('should match Colissimo shipment to FR destination', () => {
      const shipment: Shipment = {
        id: 'ship-1',
        carrier: 'colissimo',
        weight_grams: 450,
        country_code: 'FR',
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(true)
      expect(result.price).toBe(5.37)
      expect(result.rule?.id).toBe('1')
    })

    it('should match case-insensitively', () => {
      const shipment: Shipment = {
        id: 'ship-2',
        carrier: 'COLISSIMO',
        weight_grams: 450,
        country_code: 'FR',
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(true)
      expect(result.price).toBe(5.37)
    })

    it('should match correct weight tier', () => {
      const shipment: Shipment = {
        id: 'ship-3',
        carrier: 'colissimo',
        weight_grams: 500, // Exactly at boundary - should go to next tier
        country_code: 'FR',
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(true)
      expect(result.price).toBe(6.18) // 500-1000g tier
      expect(result.rule?.id).toBe('2')
    })

    it('should match relay shipments to relay rules', () => {
      const shipment: Shipment = {
        id: 'ship-4',
        carrier: 'mondial_relay',
        weight_grams: 300,
        country_code: 'FR',
        service_point_id: 'RELAY-123',
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(true)
      expect(result.price).toBe(5.88)
      expect(result.rule?.id).toBe('3')
    })

    it('should match generic destination rules', () => {
      const shipment: Shipment = {
        id: 'ship-5',
        carrier: 'dhl',
        weight_grams: 800,
        country_code: 'DE', // Germany
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(true)
      expect(result.price).toBe(12.00)
      expect(result.rule?.id).toBe('4')
    })

    it('should not match inactive rules', () => {
      const shipment: Shipment = {
        id: 'ship-6',
        carrier: 'inactive_carrier',
        weight_grams: 300,
        country_code: 'FR',
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(false)
      expect(result.reason).toContain('No pricing rule')
    })

    it('should fail for unknown carrier', () => {
      const shipment: Shipment = {
        id: 'ship-7',
        carrier: 'unknown_carrier',
        weight_grams: 300,
        country_code: 'FR',
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(false)
      expect(result.reason).toContain('No pricing rule')
    })

    it('should fail for weight exceeding all rules', () => {
      const shipment: Shipment = {
        id: 'ship-8',
        carrier: 'colissimo',
        weight_grams: 50000, // 50kg - no rule covers this
        country_code: 'FR',
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(false)
    })

    it('should fail for missing carrier', () => {
      const shipment: Shipment = {
        id: 'ship-9',
        carrier: '',
        weight_grams: 300,
        country_code: 'FR',
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(false)
      expect(result.reason).toBe('No carrier specified')
    })

    it('should fail for invalid weight', () => {
      const shipment: Shipment = {
        id: 'ship-10',
        carrier: 'colissimo',
        weight_grams: 0,
        country_code: 'FR',
        service_point_id: null,
      }

      const result = matchShipmentToRule(shipment, sampleRules)

      expect(result.matched).toBe(false)
      expect(result.reason).toBe('Invalid weight')
    })
  })

  describe('getDestination', () => {
    it('should return relay for shipments with service_point_id', () => {
      const shipment: Shipment = {
        id: 'ship-1',
        carrier: 'mondial_relay',
        weight_grams: 300,
        country_code: 'FR',
        service_point_id: 'RELAY-123',
      }

      expect(getDestination(shipment)).toBe('relay')
    })

    it('should return country_code for home delivery', () => {
      const shipment: Shipment = {
        id: 'ship-2',
        carrier: 'colissimo',
        weight_grams: 300,
        country_code: 'FR',
        service_point_id: null,
      }

      expect(getDestination(shipment)).toBe('FR')
    })

    it('should return null when no destination info', () => {
      const shipment: Shipment = {
        id: 'ship-3',
        carrier: 'colissimo',
        weight_grams: 300,
        country_code: null,
        service_point_id: null,
      }

      expect(getDestination(shipment)).toBeNull()
    })
  })

  describe('isValidPricingRule', () => {
    it('should validate correct rule', () => {
      const rule = {
        carrier: 'colissimo',
        weight_min_grams: 0,
        weight_max_grams: 500,
        unit_price_eur: 5.37,
      }

      expect(isValidPricingRule(rule)).toBe(true)
    })

    it('should reject missing carrier', () => {
      const rule = {
        carrier: '',
        weight_min_grams: 0,
        weight_max_grams: 500,
        unit_price_eur: 5.37,
      }

      expect(isValidPricingRule(rule)).toBe(false)
    })

    it('should reject weight_min >= weight_max', () => {
      expect(isValidPricingRule({
        carrier: 'colissimo',
        weight_min_grams: 500,
        weight_max_grams: 500,
        unit_price_eur: 5.37,
      })).toBe(false)

      expect(isValidPricingRule({
        carrier: 'colissimo',
        weight_min_grams: 600,
        weight_max_grams: 500,
        unit_price_eur: 5.37,
      })).toBe(false)
    })

    it('should reject negative weights', () => {
      expect(isValidPricingRule({
        carrier: 'colissimo',
        weight_min_grams: -100,
        weight_max_grams: 500,
        unit_price_eur: 5.37,
      })).toBe(false)
    })

    it('should reject negative price', () => {
      expect(isValidPricingRule({
        carrier: 'colissimo',
        weight_min_grams: 0,
        weight_max_grams: 500,
        unit_price_eur: -5,
      })).toBe(false)
    })
  })

  describe('groupShipmentsByPricing', () => {
    it('should group shipments by carrier and weight tier', () => {
      const shipments = [
        { id: '1', carrier: 'colissimo', weight_grams: 200, country_code: 'FR', service_point_id: null, computed_cost_eur: 5.37 },
        { id: '2', carrier: 'colissimo', weight_grams: 300, country_code: 'FR', service_point_id: null, computed_cost_eur: 5.37 },
        { id: '3', carrier: 'colissimo', weight_grams: 600, country_code: 'FR', service_point_id: null, computed_cost_eur: 6.18 },
        { id: '4', carrier: 'mondial_relay', weight_grams: 400, country_code: 'FR', service_point_id: 'RELAY-1', computed_cost_eur: 5.88 },
      ]

      const groups = groupShipmentsByPricing(shipments, sampleRules)

      expect(groups.size).toBe(3)

      const colissimo0_500 = groups.get('colissimo|0|500')
      expect(colissimo0_500?.count).toBe(2)
      expect(colissimo0_500?.total).toBe(10.74)
      expect(colissimo0_500?.unitPrice).toBe(5.37)

      const colissimo500_1000 = groups.get('colissimo|500|1000')
      expect(colissimo500_1000?.count).toBe(1)
      expect(colissimo500_1000?.total).toBe(6.18)

      const mondialRelay = groups.get('mondial_relay|0|500')
      expect(mondialRelay?.count).toBe(1)
      expect(mondialRelay?.total).toBe(5.88)
    })

    it('should skip unmatched shipments', () => {
      const shipments = [
        { id: '1', carrier: 'colissimo', weight_grams: 200, country_code: 'FR', service_point_id: null, computed_cost_eur: 5.37 },
        { id: '2', carrier: 'unknown', weight_grams: 300, country_code: 'FR', service_point_id: null, computed_cost_eur: 10.00 },
      ]

      const groups = groupShipmentsByPricing(shipments, sampleRules)

      expect(groups.size).toBe(1)
      expect(groups.has('colissimo|0|500')).toBe(true)
    })

    it('should handle empty shipments array', () => {
      const groups = groupShipmentsByPricing([], sampleRules)
      expect(groups.size).toBe(0)
    })
  })
})
