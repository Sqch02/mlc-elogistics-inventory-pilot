/**
 * Invoice calculation utilities
 * Extracted from invoice generation for testability
 */

export interface BillingConfig {
  software_fee_eur: number
  storage_fee_per_m3: number
  reception_fee_per_15min: number
  fuel_surcharge_pct: number
  return_fee_eur: number
  free_returns_pct: number
  vat_rate_pct: number
}

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  software_fee_eur: 49.00,
  storage_fee_per_m3: 25.00,
  reception_fee_per_15min: 30.00,
  fuel_surcharge_pct: 4.00,
  return_fee_eur: 0.90,
  free_returns_pct: 0.50,
  vat_rate_pct: 20.00,
}

export interface InvoiceLineCalculation {
  line_type: string
  description: string
  quantity: number
  unit_price_eur: number
  total_eur: number
  vat_amount: number
}

export interface InvoiceTotals {
  subtotal_ht: number
  vat_amount: number
  total_ttc: number
}

/**
 * Validate month format (YYYY-MM)
 */
export function isValidMonthFormat(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month)
}

/**
 * Calculate software fee line
 */
export function calculateSoftwareFee(config: BillingConfig): InvoiceLineCalculation {
  const total = config.software_fee_eur
  const vat = total * (config.vat_rate_pct / 100)

  return {
    line_type: 'software',
    description: 'Connexion Shopify, notifications de suivi clients, gestion commandes',
    quantity: 1,
    unit_price_eur: config.software_fee_eur,
    total_eur: total,
    vat_amount: vat,
  }
}

/**
 * Calculate storage fee line
 */
export function calculateStorageFee(
  storage_m3: number,
  config: BillingConfig
): InvoiceLineCalculation | null {
  if (storage_m3 <= 0) return null

  const total = storage_m3 * config.storage_fee_per_m3
  const vat = total * (config.vat_rate_pct / 100)

  return {
    line_type: 'storage',
    description: `Stockage & Assurance - Calculé au m³ (${storage_m3} m³)`,
    quantity: storage_m3,
    unit_price_eur: config.storage_fee_per_m3,
    total_eur: total,
    vat_amount: vat,
  }
}

/**
 * Calculate reception fee line
 */
export function calculateReceptionFee(
  reception_quarters: number,
  config: BillingConfig
): InvoiceLineCalculation | null {
  if (reception_quarters <= 0) return null

  const total = reception_quarters * config.reception_fee_per_15min
  const vat = total * (config.vat_rate_pct / 100)

  return {
    line_type: 'reception',
    description: `Frais de réception & Contrôle - Calculé au 1/4h (${reception_quarters} x 15min)`,
    quantity: reception_quarters,
    unit_price_eur: config.reception_fee_per_15min,
    total_eur: total,
    vat_amount: vat,
  }
}

/**
 * Calculate fuel surcharge line
 */
export function calculateFuelSurcharge(
  shippingTotal: number,
  config: BillingConfig
): InvoiceLineCalculation | null {
  if (shippingTotal <= 0) return null

  const surchargeRate = config.fuel_surcharge_pct / 100
  const total = shippingTotal * surchargeRate
  const vat = total * (config.vat_rate_pct / 100)

  return {
    line_type: 'fuel_surcharge',
    description: `Surcharge Carburant CAP - ${config.fuel_surcharge_pct}% du coût Prépa & Expédition`,
    quantity: config.fuel_surcharge_pct,
    unit_price_eur: shippingTotal,
    total_eur: total,
    vat_amount: vat,
  }
}

/**
 * Calculate returns fee line
 */
export function calculateReturnsFee(
  totalReturns: number,
  totalShipments: number,
  config: BillingConfig
): InvoiceLineCalculation | null {
  if (totalReturns <= 0) return null

  const freeReturnsCount = Math.floor(totalShipments * (config.free_returns_pct / 100))
  const billableReturns = Math.max(0, totalReturns - freeReturnsCount)
  const total = billableReturns * config.return_fee_eur
  const vat = total * (config.vat_rate_pct / 100)

  const description = freeReturnsCount > 0
    ? `Retour Client - ${freeReturnsCount} offerts (${config.free_returns_pct}%), ${billableReturns} facturés`
    : `Retour Client - ${billableReturns} facturés`

  return {
    line_type: 'returns',
    description,
    quantity: billableReturns,
    unit_price_eur: config.return_fee_eur,
    total_eur: total,
    vat_amount: vat,
  }
}

/**
 * Calculate free returns count
 */
export function calculateFreeReturnsCount(
  totalShipments: number,
  freeReturnsPct: number
): number {
  return Math.floor(totalShipments * (freeReturnsPct / 100))
}

/**
 * Calculate invoice totals
 */
export function calculateInvoiceTotals(lines: InvoiceLineCalculation[]): InvoiceTotals {
  const subtotal_ht = lines.reduce((sum, line) => sum + line.total_eur, 0)
  const vat_amount = lines.reduce((sum, line) => sum + line.vat_amount, 0)
  const total_ttc = subtotal_ht + vat_amount

  return {
    subtotal_ht: Math.round(subtotal_ht * 100) / 100,
    vat_amount: Math.round(vat_amount * 100) / 100,
    total_ttc: Math.round(total_ttc * 100) / 100,
  }
}

/**
 * Round to 2 decimal places
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}
