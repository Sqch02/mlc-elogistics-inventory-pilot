import type { SendcloudParcel, SendcloudResponse, ParsedShipment, SendcloudCredentials } from './types'
import { fetchMockParcels } from './mock'

const SENDCLOUD_API_URL = 'https://panel.sendcloud.sc/api/v2'

// Parse Sendcloud date format "DD-MM-YYYY HH:mm:ss" to ISO string
function parseSendcloudDate(dateStr: string | null): string | null {
  if (!dateStr) return null

  // Format: "29-12-2025 15:46:37"
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return dateStr // Return as-is if different format

  const [, day, month, year, hour, min, sec] = match
  return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
}

export function parseParcel(parcel: SendcloudParcel): ParsedShipment {
  // Convert weight from kg to grams
  const weightGrams = Math.round(parseFloat(parcel.weight) * 1000)

  // Extract items if available
  const items = parcel.parcel_items?.map((item) => ({
    sku_code: item.sku || item.description,
    qty: item.quantity,
    description: item.description,
    value: item.value ? parseFloat(item.value) : undefined,
  })).filter((item) => item.sku_code)

  // Get the best available date (prefer date_announced > date_created > created_at)
  const shippedAt = parseSendcloudDate(parcel.date_announced)
    || parseSendcloudDate(parcel.date_created)
    || parcel.created_at
    || new Date().toISOString()

  return {
    sendcloud_id: String(parcel.id),
    shipped_at: shippedAt,
    carrier: parcel.carrier?.code || 'unknown',
    service: parcel.shipment?.name || null,
    weight_grams: weightGrams,
    order_ref: parcel.order_number || null,
    tracking: parcel.tracking_number || null,
    raw_json: parcel as unknown as Record<string, unknown>,
    // New fields
    recipient_name: parcel.name || null,
    recipient_email: parcel.email || null,
    recipient_phone: parcel.telephone || null,
    recipient_company: parcel.company_name || null,
    address_line1: parcel.address || null,
    address_line2: parcel.address_2 || null,
    city: parcel.city || null,
    postal_code: parcel.postal_code || null,
    country_code: parcel.country?.iso_2 || null,
    country_name: parcel.country?.name || null,
    status_id: parcel.status?.id || null,
    status_message: parcel.status?.message || null,
    tracking_url: parcel.tracking_url || null,
    label_url: parcel.label?.label_printer || null,
    total_value: parcel.total_order_value ? parseFloat(parcel.total_order_value) : null,
    currency: parcel.total_order_value_currency || 'EUR',
    service_point_id: parcel.to_service_point ? String(parcel.to_service_point) : null,
    is_return: parcel.is_return || false,
    collo_count: parcel.collo_count || 1,
    length_cm: parcel.length || null,
    width_cm: parcel.width || null,
    height_cm: parcel.height || null,
    external_order_id: parcel.external_order_id || null,
    date_created: parseSendcloudDate(parcel.date_created),
    date_updated: parseSendcloudDate(parcel.date_updated),
    date_announced: parseSendcloudDate(parcel.date_announced),
    items: items?.length ? items : undefined,
  }
}

export async function fetchParcels(
  credentials: SendcloudCredentials,
  options?: {
    since?: string
    limit?: number
    cursor?: string
  }
): Promise<{ parcels: ParsedShipment[]; nextCursor?: string }> {
  // Check if mock mode is enabled
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    const mockParcels = await fetchMockParcels(options?.since, credentials)
    return { parcels: mockParcels }
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')

  const params = new URLSearchParams()
  if (options?.since) {
    params.set('updated_after', options.since)
  }
  if (options?.limit) {
    params.set('limit', String(options.limit))
  }
  if (options?.cursor) {
    params.set('cursor', options.cursor)
  }

  // Filter for shipped/active parcels (exclude only cancelled status 2000)
  // 1=Created, 3=Delivered, 11=Announced, 12=At sorting centre, 13=In transit, 1000=Ready to send
  params.set('status', '1,3,11,12,13,91,1000,62990')

  const url = `${SENDCLOUD_API_URL}/parcels?${params.toString()}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Sendcloud API error: ${response.status} - ${error}`)
  }

  const data: SendcloudResponse = await response.json()

  const parcels = data.parcels.map(parseParcel)

  // Extract cursor from next URL if present
  let nextCursor: string | undefined
  if (data.next) {
    const nextUrl = new URL(data.next)
    nextCursor = nextUrl.searchParams.get('cursor') || undefined
  }

  return { parcels, nextCursor }
}

export async function fetchAllParcels(
  credentials: SendcloudCredentials,
  since?: string,
  maxPages: number = 100  // Up to 10,000 parcels (100 pages x 100 per page)
): Promise<ParsedShipment[]> {
  const allParcels: ParsedShipment[] = []
  let cursor: string | undefined
  let page = 0

  while (page < maxPages) {
    const { parcels, nextCursor } = await fetchParcels(credentials, {
      since,
      cursor,
      limit: 100,
    })

    allParcels.push(...parcels)

    if (!nextCursor || parcels.length === 0) {
      break
    }

    cursor = nextCursor
    page++
  }

  return allParcels
}
