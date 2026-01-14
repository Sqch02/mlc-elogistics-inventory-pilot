import { describe, it, expect } from 'vitest'
import {
  isValidMonthFormat,
  calculateSoftwareFee,
  calculateStorageFee,
  calculateReceptionFee,
  calculateFuelSurcharge,
  calculateReturnsFee,
  calculateFreeReturnsCount,
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

  describe('calculateReturnsFee', () => {
    it('should calculate returns with free returns deduction', () => {
      // 1000 shipments, 0.5% free = 5 free returns
      // 10 total returns - 5 free = 5 billable at 0.90€ each
      const result = calculateReturnsFee(10, 1000, config)

      expect(result).not.toBeNull()
      expect(result!.line_type).toBe('returns')
      expect(result!.quantity).toBe(5) // billable returns
      expect(result!.unit_price_eur).toBe(0.90)
      expect(result!.total_eur).toBe(4.50) // 5 * 0.90
      expect(result!.vat_amount).toBe(0.90) // 4.50 * 0.20
    })

    it('should return zero billable if returns <= free returns', () => {
      // 1000 shipments, 0.5% free = 5 free returns
      // 3 total returns - all free
      const result = calculateReturnsFee(3, 1000, config)

      expect(result).not.toBeNull()
      expect(result!.quantity).toBe(0)
      expect(result!.total_eur).toBe(0)
    })

    it('should return null for zero returns', () => {
      expect(calculateReturnsFee(0, 1000, config)).toBeNull()
    })

    it('should never have negative billable returns', () => {
      const result = calculateReturnsFee(2, 1000, config) // 2 returns, 5 free

      expect(result!.quantity).toBeGreaterThanOrEqual(0)
      expect(result!.total_eur).toBeGreaterThanOrEqual(0)
    })
  })

  describe('calculateFreeReturnsCount', () => {
    it('should calculate 0.5% of shipments', () => {
      expect(calculateFreeReturnsCount(1000, 0.5)).toBe(5)
      expect(calculateFreeReturnsCount(200, 0.5)).toBe(1)
      expect(calculateFreeReturnsCount(100, 0.5)).toBe(0) // floor(0.5)
    })

    it('should floor the result', () => {
      expect(calculateFreeReturnsCount(350, 0.5)).toBe(1) // floor(1.75)
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
    it('should calculate a complete invoice with all line types', () => {
      // Simulate a real invoice scenario
      const shippingTotal = 5000.00 // €5000 in shipping
      const totalShipments = 1000
      const totalReturns = 10
      const storage_m3 = 5
      const reception_quarters = 2

      const lines = [
        calculateSoftwareFee(config),
        calculateStorageFee(storage_m3, config),
        calculateReceptionFee(reception_quarters, config),
        // Shipping would be added separately with carrier/weight groups
        { line_type: 'shipping', description: 'Shipping', quantity: totalShipments, unit_price_eur: 5, total_eur: shippingTotal, vat_amount: shippingTotal * 0.20 },
        calculateFuelSurcharge(shippingTotal, config),
        calculateReturnsFee(totalReturns, totalShipments, config),
      ].filter(Boolean) as Array<{ line_type: string; description: string; quantity: number; unit_price_eur: number; total_eur: number; vat_amount: number }>

      const totals = calculateInvoiceTotals(lines)

      // Verify breakdown
      const softwareLine = lines.find(l => l.line_type === 'software')
      const storageLine = lines.find(l => l.line_type === 'storage')
      const receptionLine = lines.find(l => l.line_type === 'reception')
      const shippingLine = lines.find(l => l.line_type === 'shipping')
      const fuelLine = lines.find(l => l.line_type === 'fuel_surcharge')
      const returnsLine = lines.find(l => l.line_type === 'returns')

      expect(softwareLine!.total_eur).toBe(49.00)
      expect(storageLine!.total_eur).toBe(125.00) // 5 * 25
      expect(receptionLine!.total_eur).toBe(60.00) // 2 * 30
      expect(shippingLine!.total_eur).toBe(5000.00)
      expect(fuelLine!.total_eur).toBe(200.00) // 5000 * 0.04
      expect(returnsLine!.total_eur).toBe(4.50) // (10-5) * 0.90

      // Total HT: 49 + 125 + 60 + 5000 + 200 + 4.50 = 5438.50
      expect(totals.subtotal_ht).toBe(5438.50)

      // VAT 20% of each
      // 9.80 + 25 + 12 + 1000 + 40 + 0.90 = 1087.70
      expect(totals.vat_amount).toBe(1087.70)

      // TTC
      expect(totals.total_ttc).toBe(6526.20)
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
