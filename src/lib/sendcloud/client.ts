import type { SendcloudParcel, SendcloudResponse, ParsedShipment, SendcloudCredentials } from './types'
import { fetchMockParcels } from './mock'

const SENDCLOUD_API_URL = 'https://panel.sendcloud.sc/api/v2'

export function parseParcel(parcel: SendcloudParcel): ParsedShipment {
  // Convert weight from kg to grams
  const weightGrams = Math.round(parseFloat(parcel.weight) * 1000)

  // Extract items if available
  const items = parcel.parcel_items?.map((item) => ({
    sku_code: item.sku || item.description,
    qty: item.quantity,
  })).filter((item) => item.sku_code)

  return {
    sendcloud_id: String(parcel.id),
    shipped_at: parcel.created_at,
    carrier: parcel.carrier?.code || 'unknown',
    service: parcel.shipment?.name || null,
    weight_grams: weightGrams,
    order_ref: parcel.order_number || null,
    tracking: parcel.tracking_number || null,
    raw_json: parcel as unknown as Record<string, unknown>,
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

  // Filter for shipped parcels only
  params.set('status', '1000,3,11') // Ready to send, Delivered, Announced

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
  maxPages: number = 10
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
