import { describe, it, expect } from 'vitest'
import {
  isValidMonthFormat,
  calculateSoftwareFee,
  calculateStorageFee,
  calculateReceptionFee,
  calculateFuelSurcharge,
  calculateInvoiceTotals,
  roundCurrency,
  DEFAULT_BILLING_CONFIG,
  type BillingConfig,
} from './invoice-calculations'

describe('Invoice Calculations', () => {
  const config: BillingConfig = DEFAULT_BILLING_CONFIG

  describe('isValidMonthFormat', () => {
    it('should accept valid YYYY-MM format', () => {
      expect(isValidMonthFormat('2025-01')).toBe(true)
      expect(isValidMonthFormat('2025-12')).toBe(true)
      expect(isValidMonthFormat('2024-06')).toBe(true)
    })

    it('should reject invalid formats', () => {
      expect(isValidMonthFormat('2025-1')).toBe(false)
      expect(isValidMonthFormat('25-01')).toBe(false)
      expect(isValidMonthFormat('2025/01')).toBe(false)
      expect(isValidMonthFormat('01-2025')).toBe(false)
      expect(isValidMonthFormat('')).toBe(false)
      expect(isValidMonthFormat('invalid')).toBe(false)
    })
  })

  describe('calculateSoftwareFee', () => {
    it('should calculate software fee with correct VAT', () => {
      const result = calculateSoftwareFee(config)

      expect(result.line_type).toBe('software')
      expect(result.quantity).toBe(1)
      expect(result.unit_price_eur).toBe(49.00)
      expect(result.total_eur).toBe(49.00)
      expect(result.vat_amount).toBe(9.80) // 49 * 0.20
    })

    it('should use custom config values', () => {
      const customConfig = { ...config, software_fee_eur: 100.00 }
      const result = calculateSoftwareFee(customConfig)

      expect(result.total_eur).toBe(100.00)
      expect(result.vat_amount).toBe(20.00)
    })
  })

  describe('calculateStorageFee', () => {
    it('should calculate storage fee per m3', () => {
      const result = calculateStorageFee(10, config)

      expect(result).not.toBeNull()
      expect(result!.line_type).toBe('storage')
      expect(result!.quantity).toBe(10)
      expect(result!.unit_price_eur).toBe(25.00)
      expect(result!.total_eur).toBe(250.00) // 10 * 25
      expect(result!.vat_amount).toBe(50.00) // 250 * 0.20
    })

    it('should return null for zero storage', () => {
      expect(calculateStorageFee(0, config)).toBeNull()
    })

    it('should return null for negative storage', () => {
      expect(calculateStorageFee(-5, config)).toBeNull()
    })
  })

  describe('calculateReceptionFee', () => {
    it('should calculate reception fee per 15min quarter', () => {
      const result = calculateReceptionFee(4, config) // 1 hour

      expect(result).not.toBeNull()
      expect(result!.line_type).toBe('reception')
      expect(result!.quantity).toBe(4)
      expect(result!.unit_price_eur).toBe(30.00)
      expect(result!.total_eur).toBe(120.00) // 4 * 30
      expect(result!.vat_amount).toBe(24.00) // 120 * 0.20
    })

    it('should return null for zero quarters', () => {
      expect(calculateReceptionFee(0, config)).toBeNull()
    })
  })

  describe('calculateFuelSurcharge', () => {
    it('should calculate 4% fuel surcharge on shipping total', () => {
      const shippingTotal = 1000.00
      const result = calculateFuelSurcharge(shippingTotal, config)

      expect(result).not.toBeNull()
      expect(result!.line_type).toBe('fuel_surcharge')
      expect(result!.total_eur).toBe(40.00) // 1000 * 0.04
      expect(result!.vat_amount).toBe(8.00) // 40 * 0.20
    })

    it('should return null for zero shipping', () => {
      expect(calculateFuelSurcharge(0, config)).toBeNull()
    })

    it('should handle different surcharge rates', () => {
      const customConfig = { ...config, fuel_surcharge_pct: 5.00 }
      const result = calculateFuelSurcharge(1000, customConfig)

      expect(result!.total_eur).toBe(50.00) // 1000 * 0.05
    })
  })

  describe('calculateInvoiceTotals', () => {
    it('should sum all line totals correctly', () => {
      const lines = [
        { line_type: 'software', description: '', quantity: 1, unit_price_eur: 49, total_eur: 49.00, vat_amount: 9.80 },
        { line_type: 'shipping', description: '', quantity: 100, unit_price_eur: 5.37, total_eur: 537.00, vat_amount: 107.40 },
        { line_type: 'fuel_surcharge', description: '', quantity: 4, unit_price_eur: 537, total_eur: 21.48, vat_amount: 4.30 },
      ]

      const totals = calculateInvoiceTotals(lines)

      expect(totals.subtotal_ht).toBe(607.48) // 49 + 537 + 21.48
      expect(totals.vat_amount).toBe(121.50) // 9.80 + 107.40 + 4.30
      expect(totals.total_ttc).toBe(728.98) // 607.48 + 121.50
    })

    it('should handle empty lines array', () => {
      const totals = calculateInvoiceTotals([])

      expect(totals.subtotal_ht).toBe(0)
      expect(totals.vat_amount).toBe(0)
      expect(totals.total_ttc).toBe(0)
    })

    it('should round to 2 decimal places', () => {
      const lines = [
        { line_type: 'test', description: '', quantity: 1, unit_price_eur: 10.333, total_eur: 10.333, vat_amount: 2.0666 },
      ]

      const totals = calculateInvoiceTotals(lines)

      expect(totals.subtotal_ht).toBe(10.33)
      expect(totals.vat_amount).toBe(2.07)
      expect(totals.total_ttc).toBe(12.40)
    })
  })

  describe('roundCurrency', () => {
    it('should round to 2 decimal places', () => {
      expect(roundCurrency(10.333)).toBe(10.33)
      expect(roundCurrency(10.335)).toBe(10.34)
      expect(roundCurrency(10.999)).toBe(11.00)
      expect(roundCurrency(10)).toBe(10)
    })
  })

  describe('Full Invoice Calculation Flow', () => {
    it('should calculate a complete invoice with all line types (returns priced like outbound)', () => {
      // Simulate a real invoice scenario
      // Returns are now priced using the same carrier/weight pricing rules as outbound
      const outboundShippingTotal = 5000.00
      const returnShippingTotal = 150.00 // returns billed at actual shipping cost
      const shippingTotal = outboundShippingTotal + returnShippingTotal
      const storage_m3 = 5
      const reception_quarters = 2

      const lines = [
        calculateSoftwareFee(config),
        calculateStorageFee(storage_m3, config),
        calculateReceptionFee(reception_quarters, config),
        // Outbound shipping lines
        { line_type: 'shipping', description: 'DOMICILE FR 0g - 500g', quantity: 1000, unit_price_eur: 5, total_eur: outboundShippingTotal, vat_amount: outboundShippingTotal * 0.20 },
        // Return shipping lines (same pricing as outbound, prefixed with RETOUR)
        { line_type: 'returns', description: 'RETOUR DOMICILE FR 0g - 500g', quantity: 30, unit_price_eur: 5, total_eur: returnShippingTotal, vat_amount: returnShippingTotal * 0.20 },
        calculateFuelSurcharge(shippingTotal, config),
      ].filter(Boolean) as Array<{ line_type: string; description: string; quantity: number; unit_price_eur: number; total_eur: number; vat_amount: number }>

      const totals = calculateInvoiceTotals(lines)

      // Verify breakdown
      const softwareLine = lines.find(l => l.line_type === 'software')
      const storageLine = lines.find(l => l.line_type === 'storage')
      const receptionLine = lines.find(l => l.line_type === 'reception')
      const shippingLine = lines.find(l => l.line_type === 'shipping')
      const returnsLine = lines.find(l => l.line_type === 'returns')
      const fuelLine = lines.find(l => l.line_type === 'fuel_surcharge')

      expect(softwareLine!.total_eur).toBe(49.00)
      expect(storageLine!.total_eur).toBe(125.00) // 5 * 25
      expect(receptionLine!.total_eur).toBe(60.00) // 2 * 30
      expect(shippingLine!.total_eur).toBe(5000.00)
      expect(returnsLine!.total_eur).toBe(150.00) // returns at actual shipping cost
      expect(fuelLine!.total_eur).toBe(206.00) // (5000 + 150) * 0.04

      // Total HT: 49 + 125 + 60 + 5000 + 150 + 206 = 5590
      expect(totals.subtotal_ht).toBe(5590.00)

      // VAT 20% of each
      // 9.80 + 25 + 12 + 1000 + 30 + 41.20 = 1118
      expect(totals.vat_amount).toBe(1118.00)

      // TTC
      expect(totals.total_ttc).toBe(6708.00)
    })

    it('should handle invoice with only software and shipping', () => {
      const shippingTotal = 1000.00

      const lines = [
        calculateSoftwareFee(config),
        { line_type: 'shipping', description: 'Shipping', quantity: 100, unit_price_eur: 10, total_eur: shippingTotal, vat_amount: shippingTotal * 0.20 },
        calculateFuelSurcharge(shippingTotal, config),
      ].filter(Boolean) as Array<{ line_type: string; description: string; quantity: number; unit_price_eur: number; total_eur: number; vat_amount: number }>

      const totals = calculateInvoiceTotals(lines)

      // 49 + 1000 + 40 = 1089
      expect(totals.subtotal_ht).toBe(1089.00)
      // VAT: 9.80 + 200 + 8 = 217.80
      expect(totals.vat_amount).toBe(217.80)
      expect(totals.total_ttc).toBe(1306.80)
    })
  })
})
