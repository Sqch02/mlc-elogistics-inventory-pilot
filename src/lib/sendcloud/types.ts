export interface SendcloudParcel {
  id: number
  tracking_number: string
  tracking_url?: string
  carrier: {
    code: string
  }
  name: string
  email?: string
  telephone?: string
  company_name?: string
  address: string
  address_2?: string
  city: string
  postal_code: string
  country: {
    iso_2: string
    iso_3?: string
    name?: string
  }
  weight: string // in kg
  length?: number | null
  width?: number | null
  height?: number | null
  order_number: string
  external_order_id?: string
  shipment: {
    id: number
    name: string
  }
  status: {
    id: number
    message: string
  }
  created_at: string | null
  date_created: string | null  // Format: "DD-MM-YYYY HH:mm:ss"
  date_updated: string | null
  date_announced: string | null
  updated_at: string
  label?: {
    label_printer: string
    normal_printer?: string[]
  }
  total_order_value?: string
  total_order_value_currency?: string
  to_service_point?: number | string | null
  is_return?: boolean
  collo_count?: number
  parcel_items?: Array<{
    description: string
    sku?: string
    quantity: number
    weight: string
    value: string
    hs_code?: string
    origin_country?: string
    product_id?: string
  }>
}

export interface SendcloudResponse {
  parcels: SendcloudParcel[]
  next?: string
}

export interface SendcloudCredentials {
  apiKey: string
  secret: string
}

export interface ParsedShipment {
  sendcloud_id: string
  shipped_at: string
  carrier: string
  service: string | null
  weight_grams: number
  order_ref: string | null
  tracking: string | null
  raw_json: Record<string, unknown>
  // New fields
  recipient_name: string | null
  recipient_email: string | null
  recipient_phone: string | null
  recipient_company: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postal_code: string | null
  country_code: string | null
  country_name: string | null
  status_id: number | null
  status_message: string | null
  tracking_url: string | null
  label_url: string | null
  total_value: number | null
  currency: string
  service_point_id: string | null
  is_return: boolean
  collo_count: number
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  external_order_id: string | null
  date_created: string | null
  date_updated: string | null
  date_announced: string | null
  items?: Array<{
    sku_code: string
    qty: number
    description?: string
    value?: number
  }>
}

// ============================================
// RETURNS TYPES
// ============================================

export interface SendcloudReturn {
  id: number
  brand_id?: number
  created_at: string
  updated_at?: string
  reason?: string
  message?: string
  status: {
    id: number
    message: string
  }
  refund?: {
    refund_type: string
    message?: string
  }
  incoming_parcel: {
    id: number
    tracking_number?: string
    tracking_url?: string
    carrier?: {
      code: string
      name?: string
    }
    status?: {
      id: number
      message: string
    }
    collo_count?: number
    from_name?: string
    from_email?: string
    from_telephone?: string
    from_company_name?: string
    from_address_1?: string
    from_address_2?: string
    from_city?: string
    from_postal_code?: string
    from_country?: string
    created_at?: string
    announced_at?: string
    weight?: string
  }
  outgoing_parcel?: {
    id: number
    tracking_number?: string
    order_number?: string
  }
}

export interface SendcloudReturnsResponse {
  returns: SendcloudReturn[]
  next?: string
  previous?: string
}

export interface ParsedReturn {
  sendcloud_id: string
  sendcloud_return_id: string
  order_ref: string | null
  tracking_number: string | null
  tracking_url: string | null
  carrier: string | null
  service: string | null
  status: string
  status_message: string | null
  sender_name: string | null
  sender_email: string | null
  sender_phone: string | null
  sender_company: string | null
  sender_address: string | null
  sender_city: string | null
  sender_postal_code: string | null
  sender_country_code: string | null
  return_reason: string | null
  return_reason_comment: string | null
  created_at: string
  announced_at: string | null
  raw_json: Record<string, unknown>
}
