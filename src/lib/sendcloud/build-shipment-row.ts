import type { ParsedShipment } from '@/lib/sendcloud/types'
import { getDestination, type PricingRule } from '@/lib/utils/pricing'

export function buildShipmentRow(
  tenantId: string,
  parcel: ParsedShipment,
  pricingRules: PricingRule[] | null,
) {
  let pricingStatus: 'ok' | 'missing' = 'missing'
  let computedCost: number | null = null

  if (pricingRules) {
    const destination = getDestination(
      parcel.country_code,
      parcel.carrier,
      parcel.service_point_id,
    )
    const matchingRule = pricingRules.find(
      (rule) =>
        rule.carrier.toLowerCase() === parcel.carrier.toLowerCase() &&
        rule.destination === destination &&
        rule.weight_min_grams <= parcel.weight_grams &&
        rule.weight_max_grams >= parcel.weight_grams,
    )

    if (matchingRule) {
      pricingStatus = 'ok'
      computedCost = Number(matchingRule.price_eur)
    }
  }

  return {
    tenant_id: tenantId,
    sendcloud_id: parcel.sendcloud_id,
    shipped_at: parcel.shipped_at,
    carrier: parcel.carrier,
    service: parcel.service,
    weight_grams: parcel.weight_grams,
    order_ref: parcel.order_ref,
    tracking: parcel.tracking,
    pricing_status: pricingStatus,
    computed_cost_eur: computedCost,
    raw_json: parcel.raw_json,
    recipient_name: parcel.recipient_name,
    recipient_email: parcel.recipient_email,
    recipient_phone: parcel.recipient_phone,
    recipient_company: parcel.recipient_company,
    address_line1: parcel.address_line1,
    address_line2: parcel.address_line2,
    house_number: parcel.house_number,
    city: parcel.city,
    postal_code: parcel.postal_code,
    country_code: parcel.country_code,
    country_name: parcel.country_name,
    status_id: parcel.status_id,
    status_message: parcel.status_message,
    tracking_url: parcel.tracking_url,
    label_url: parcel.label_url,
    total_value: parcel.total_value,
    currency: parcel.currency,
    service_point_id: parcel.service_point_id,
    is_return: parcel.is_return,
    collo_count: parcel.collo_count,
    length_cm: parcel.length_cm,
    width_cm: parcel.width_cm,
    height_cm: parcel.height_cm,
    external_order_id: parcel.external_order_id,
    date_created: parcel.date_created,
    date_updated: parcel.date_updated,
    date_announced: parcel.date_announced,
    has_error: parcel.has_error,
    error_message: parcel.error_message,
  }
}
