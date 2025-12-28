export interface SendcloudParcel {
  id: number
  tracking_number: string
  carrier: {
    code: string
  }
  name: string
  address: string
  city: string
  postal_code: string
  country: {
    iso_2: string
  }
  weight: string // in kg
  order_number: string
  shipment: {
    id: number
    name: string
  }
  status: {
    id: number
    message: string
  }
  created_at: string
  updated_at: string
  label?: {
    label_printer: string
  }
  parcel_items?: Array<{
    description: string
    sku?: string
    quantity: number
    weight: string
    value: string
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
  items?: Array<{
    sku_code: string
    qty: number
  }>
}
