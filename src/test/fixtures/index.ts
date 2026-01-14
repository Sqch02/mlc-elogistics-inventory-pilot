import { TEST_TENANT_ID } from '../utils'

/**
 * Test fixtures for MLC E-Logistics
 */

export const fixtures = {
  sku: {
    basic: {
      id: '11111111-1111-1111-1111-111111111111',
      tenant_id: TEST_TENANT_ID,
      sku_code: 'SKU-TEST-001',
      name: 'Test Product',
      weight_grams: 500,
      active: true,
      alert_threshold: 10,
      unit_price_eur: 25.00,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    bundle: {
      id: '22222222-2222-2222-2222-222222222222',
      tenant_id: TEST_TENANT_ID,
      sku_code: 'BU-BUNDLE-001',
      name: 'Test Bundle',
      weight_grams: 1000,
      active: true,
      alert_threshold: 5,
      unit_price_eur: 50.00,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  },

  shipment: {
    basic: {
      id: '33333333-3333-3333-3333-333333333333',
      tenant_id: TEST_TENANT_ID,
      sendcloud_id: 'SC-12345',
      shipped_at: '2025-12-15T10:30:00Z',
      carrier: 'colissimo',
      service: 'home_delivery',
      weight_grams: 450,
      order_ref: 'ORD-001',
      tracking: 'TRACK123',
      pricing_status: 'ok',
      computed_cost_eur: 6.50,
      recipient_name: 'Jean Dupont',
      country_code: 'FR',
      status_id: 11,
      status_message: 'Delivered',
      is_return: false,
    },
    withMissingPricing: {
      id: '44444444-4444-4444-4444-444444444444',
      tenant_id: TEST_TENANT_ID,
      sendcloud_id: 'SC-12346',
      shipped_at: '2025-12-15T11:00:00Z',
      carrier: 'unknown_carrier',
      service: 'express',
      weight_grams: 2500,
      order_ref: 'ORD-002',
      tracking: 'TRACK124',
      pricing_status: 'missing',
      computed_cost_eur: null,
      recipient_name: 'Marie Martin',
      country_code: 'FR',
      status_id: 11,
      status_message: 'Delivered',
      is_return: false,
    },
    return: {
      id: '55555555-5555-5555-5555-555555555555',
      tenant_id: TEST_TENANT_ID,
      sendcloud_id: 'SC-12347',
      shipped_at: '2025-12-16T09:00:00Z',
      carrier: 'colissimo',
      service: 'return',
      weight_grams: 300,
      order_ref: 'ORD-001-RET',
      tracking: 'TRACK125',
      pricing_status: 'ok',
      computed_cost_eur: 0.90,
      recipient_name: 'MLC Entrepot',
      country_code: 'FR',
      status_id: 11,
      status_message: 'Delivered',
      is_return: true,
    },
  },

  pricingRule: {
    colissimo500: {
      id: '66666666-6666-6666-6666-666666666666',
      tenant_id: TEST_TENANT_ID,
      carrier: 'colissimo',
      destination: 'FR',
      weight_min_grams: 0,
      weight_max_grams: 500,
      unit_price_eur: 5.37,
      active: true,
    },
    colissimo1000: {
      id: '77777777-7777-7777-7777-777777777777',
      tenant_id: TEST_TENANT_ID,
      carrier: 'colissimo',
      destination: 'FR',
      weight_min_grams: 500,
      weight_max_grams: 1000,
      unit_price_eur: 6.18,
      active: true,
    },
    mondialRelay500: {
      id: '88888888-8888-8888-8888-888888888888',
      tenant_id: TEST_TENANT_ID,
      carrier: 'mondial_relay',
      destination: 'FR',
      weight_min_grams: 0,
      weight_max_grams: 500,
      unit_price_eur: 5.88,
      active: true,
    },
  },

  invoice: {
    draft: {
      id: '99999999-9999-9999-9999-999999999999',
      tenant_id: TEST_TENANT_ID,
      month: '2025-12',
      total_eur: 1000.00,
      subtotal_ht: 1000.00,
      vat_amount: 200.00,
      total_ttc: 1200.00,
      missing_pricing_count: 2,
      status: 'draft',
      created_at: '2026-01-01T00:00:00Z',
    },
  },

  invoiceLine: {
    software: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      invoice_id: '99999999-9999-9999-9999-999999999999',
      line_type: 'software',
      description: 'Abonnement logiciel',
      shipment_count: 0,
      quantity: 1,
      unit_price_eur: 49.00,
      total_eur: 49.00,
    },
    shipping: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      invoice_id: '99999999-9999-9999-9999-999999999999',
      line_type: 'shipping',
      description: 'Prépa & Expédition - Colissimo 500g',
      carrier: 'colissimo',
      weight_min_grams: 0,
      weight_max_grams: 500,
      shipment_count: 150,
      quantity: 150,
      unit_price_eur: 5.37,
      total_eur: 805.50,
    },
  },

  billingConfig: {
    default: {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      tenant_id: TEST_TENANT_ID,
      software_fee_eur: 49.00,
      storage_fee_per_m3: 25.00,
      reception_fee_per_15min: 30.00,
      fuel_surcharge_pct: 4.00,
      return_fee_eur: 0.90,
      free_returns_pct: 0.50,
      vat_rate_pct: 20.00,
    },
  },

  claim: {
    open: {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      tenant_id: TEST_TENANT_ID,
      shipment_id: '33333333-3333-3333-3333-333333333333',
      order_ref: 'ORD-001',
      opened_at: '2025-12-20T10:00:00Z',
      status: 'en_analyse',
      claim_type: 'colis_endommage',
      description: 'Colis arrivé endommagé',
      priority: 'medium',
    },
    compensated: {
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      tenant_id: TEST_TENANT_ID,
      shipment_id: '44444444-4444-4444-4444-444444444444',
      order_ref: 'ORD-002',
      opened_at: '2025-12-18T10:00:00Z',
      status: 'indemnisee',
      claim_type: 'colis_perdu',
      description: 'Colis perdu par transporteur',
      indemnity_eur: 45.00,
      decided_at: '2025-12-22T14:00:00Z',
      priority: 'high',
    },
  },

  location: {
    basic: {
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      tenant_id: TEST_TENANT_ID,
      code: 'A1-R1-H1',
      allee: '1',
      rack: 'A',
      hauteur_max: 1,
      active: true,
      status: 'available',
    },
  },
}

/**
 * Helper to create variations of fixtures
 */
export function createFixture<T extends Record<string, unknown>>(
  base: T,
  overrides: Partial<T> = {}
): T {
  return { ...base, ...overrides }
}
