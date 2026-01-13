import { z } from 'zod'

// SKU Import Schema
export const skuImportRowSchema = z.object({
  sku_code: z.string().min(1, 'SKU code requis'),
  name: z.string().min(1, 'Nom requis'),
  weight_grams: z.coerce.number().optional().nullable(),
  qty_current: z.coerce.number().int().min(0).optional().default(0),
  active: z.string().optional().transform((v) => v?.toLowerCase() !== 'false'),
})

export type SKUImportRow = z.infer<typeof skuImportRowSchema>

// Bundle/BOM Import Schema
export const bundleImportRowSchema = z.object({
  bundle_sku_code: z.string().min(1, 'Bundle SKU code requis'),
  component_sku_code: z.string().min(1, 'Component SKU code requis'),
  qty_component: z.coerce.number().int().min(1, 'Quantite >= 1').default(1),
})

export type BundleImportRow = z.infer<typeof bundleImportRowSchema>

// Pricing Import Schema
export const pricingImportRowSchema = z.object({
  carrier: z.string().min(1, 'Transporteur requis'),
  weight_min_grams: z.coerce.number().int().min(0, 'Poids min >= 0'),
  weight_max_grams: z.coerce.number().int().min(1, 'Poids max >= 1'),
  price_eur: z.coerce.number().min(0, 'Prix >= 0'),
}).refine((data) => data.weight_min_grams < data.weight_max_grams, {
  message: 'Poids min doit etre < poids max',
  path: ['weight_min_grams'],
})

export type PricingImportRow = z.infer<typeof pricingImportRowSchema>

// Location Import Schema
export const locationImportRowSchema = z.object({
  code: z.string().min(1, 'Code emplacement requis'),
  label: z.string().optional().nullable(),
  sku_code: z.string().optional().nullable(), // Optional: assign SKU at import
  active: z.string().optional().transform((v) => v?.toLowerCase() !== 'false'),
})

export type LocationImportRow = z.infer<typeof locationImportRowSchema>

// Shipment Items Import Schema (fallback)
export const shipmentItemsImportRowSchema = z.object({
  sendcloud_id: z.string().min(1, 'Sendcloud ID requis'),
  sku_code: z.string().min(1, 'SKU code requis'),
  qty: z.coerce.number().int().min(1, 'Quantite >= 1').default(1),
})

export type ShipmentItemsImportRow = z.infer<typeof shipmentItemsImportRowSchema>

// Claims Import Schema
export const claimsImportRowSchema = z.object({
  order_ref: z.string().min(1, 'Référence commande requise'),
  claim_type: z.string().optional().transform((v) => {
    if (!v) return 'lost'
    const lower = v.toLowerCase()
    if (lower.includes('perdu') || lower.includes('lost')) return 'lost'
    if (lower.includes('endom') || lower.includes('damage')) return 'damaged'
    if (lower.includes('manqu') || lower.includes('missing')) return 'missing_item'
    if (lower.includes('retard') || lower.includes('delay')) return 'delay'
    return 'other'
  }),
  description: z.string().optional().nullable(),
  status: z.string().optional().transform((v) => {
    if (!v) return 'ouverte'
    const lower = v.toLowerCase()
    if (lower.includes('ouvert') || lower.includes('open')) return 'ouverte'
    if (lower.includes('analyse') || lower.includes('review')) return 'en_analyse'
    if (lower.includes('indem') || lower.includes('paid')) return 'indemnisee'
    if (lower.includes('refus') || lower.includes('reject')) return 'refusee'
    if (lower.includes('clotur') || lower.includes('close')) return 'cloturee'
    return 'ouverte'
  }),
  indemnity_eur: z.coerce.number().optional().nullable(),
  priority: z.string().optional().transform((v) => {
    if (!v) return 'normal'
    const lower = v.toLowerCase()
    if (lower.includes('haute') || lower.includes('high') || lower.includes('urgent')) return 'haute'
    if (lower.includes('basse') || lower.includes('low')) return 'basse'
    return 'normal'
  }),
  opened_at: z.string().optional().nullable(),
  decision_note: z.string().optional().nullable(),
})

export type ClaimsImportRow = z.infer<typeof claimsImportRowSchema>

// Inbound Restock Import Schema
export const restockImportRowSchema = z.object({
  sku_code: z.string().min(1, 'SKU code requis'),
  qty: z.coerce.number().int().min(1, 'Quantite >= 1'),
  eta_date: z.string().min(1, 'Date ETA requise'),
  note: z.string().optional().nullable(),
})

export type RestockImportRow = z.infer<typeof restockImportRowSchema>

// Validation result type
export interface ValidationResult<T> {
  valid: T[]
  invalid: Array<{
    row: number
    data: unknown
    errors: string[]
  }>
}

export function validateRows<T>(
  rows: unknown[],
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  const valid: T[] = []
  const invalid: ValidationResult<T>['invalid'] = []

  rows.forEach((row, index) => {
    const result = schema.safeParse(row)
    if (result.success) {
      valid.push(result.data)
    } else {
      invalid.push({
        row: index + 2, // +2 for 1-indexed and header row
        data: row,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      })
    }
  })

  return { valid, invalid }
}
