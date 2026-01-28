import type {
  SendcloudParcel,
  SendcloudResponse,
  ParsedShipment,
  SendcloudCredentials,
  SendcloudReturn,
  SendcloudReturnsResponse,
  ParsedReturn
} from './types'
import { fetchMockParcels } from './mock'

const SENDCLOUD_API_URL = 'https://panel.sendcloud.sc/api/v2'

// Parse Sendcloud date format to ISO string
// Supports multiple formats: "DD-MM-YYYY HH:mm:ss", ISO 8601, Unix timestamp
function parseSendcloudDate(dateStr: string | number | null | undefined): string | null {
  if (!dateStr) return null

  // If it's a number (Unix timestamp in seconds or milliseconds)
  if (typeof dateStr === 'number') {
    // If timestamp is in seconds (before year 3000), convert to ms
    const ts = dateStr < 100000000000 ? dateStr * 1000 : dateStr
    return new Date(ts).toISOString()
  }

  const str = String(dateStr).trim()
  if (!str) return null

  // Format 1: "29-12-2025 15:46:37" (DD-MM-YYYY HH:mm:ss)
  const match1 = str.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/)
  if (match1) {
    const [, day, month, year, hour, min, sec] = match1
    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
  }

  // Format 2: "29/12/2025 15:46:37" (DD/MM/YYYY HH:mm:ss)
  const match2 = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/)
  if (match2) {
    const [, day, month, year, hour, min, sec] = match2
    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
  }

  // Format 3: ISO 8601 (2025-01-03T14:30:00Z or 2025-01-03T14:30:00.000Z)
  if (str.match(/^\d{4}-\d{2}-\d{2}T/)) {
    // Already ISO format, validate it
    const date = new Date(str)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  // Format 4: "2025-01-03 14:30:00" (YYYY-MM-DD HH:mm:ss)
  const match4 = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (match4) {
    const [, year, month, day, hour, min, sec] = match4
    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
  }

  // Format 5: Just date "2025-01-03" or "03-01-2025"
  const match5a = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match5a) {
    const [, year, month, day] = match5a
    return `${year}-${month}-${day}T00:00:00Z`
  }

  const match5b = str.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (match5b) {
    const [, day, month, year] = match5b
    return `${year}-${month}-${day}T00:00:00Z`
  }

  // Try native Date parsing as last resort
  const date = new Date(str)
  if (!isNaN(date.getTime())) {
    return date.toISOString()
  }

  console.warn('[Sendcloud] Could not parse date:', str)
  return null
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

  // Get the best available date (prefer date_created > date_announced > created_at)
  // date_created = when the parcel was created in Sendcloud (DD-MM-YYYY format)
  // date_announced = when it was announced to carrier
  // created_at = ISO timestamp
  let shippedAt = parseSendcloudDate(parcel.date_created)
    || parseSendcloudDate(parcel.date_announced)
    || parseSendcloudDate(parcel.date_updated)
    || parseSendcloudDate(parcel.created_at)
    || parseSendcloudDate(parcel.updated_at)

  // If no date found, log warning and use current date as last resort
  if (!shippedAt) {
    console.warn('[Sendcloud] No valid date found for parcel', parcel.id, '- dates:', {
      date_created: parcel.date_created,
      date_announced: parcel.date_announced,
      date_updated: parcel.date_updated,
    })
    shippedAt = new Date().toISOString()
  }

  // Error detection based on status
  const ERROR_STATUS_IDS = [91, 92, 93, 1999, 2000, 2001]
  const statusId = parcel.status?.id || null
  const hasStatusError = statusId !== null && ERROR_STATUS_IDS.includes(statusId)

  // Check for errors in raw parcel data
  const rawErrors = (parcel as Record<string, unknown>).errors as Record<string, string[]> | undefined
  const hasFieldErrors = rawErrors && Object.keys(rawErrors).length > 0

  const has_error = hasStatusError || !!hasFieldErrors
  let error_message: string | null = null

  if (hasFieldErrors && rawErrors) {
    error_message = Object.entries(rawErrors)
      .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
      .join('; ')
  } else if (hasStatusError) {
    error_message = parcel.status?.message || 'Erreur Sendcloud'
  }

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
    // Error detection fields
    has_error,
    error_message,
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

  // Don't filter by status - fetch ALL parcels to get complete history
  // Previously filtered: 1=Created, 3=Delivered, 11=Announced, etc.
  // Removed filter to include all statuses including archived/delivered

  const url = `${SENDCLOUD_API_URL}/parcels?${params.toString()}`

  console.log(`[Sendcloud API] Calling: ${url.replace(/\/\/.*:.*@/, '//<redacted>@')}`)
  console.log(`[Sendcloud API] Params: since=${options?.since || 'NONE'}, limit=${options?.limit || 'default'}, cursor=${options?.cursor || 'NONE'}`)

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Sendcloud API] ERROR ${response.status}: ${error}`)
    throw new Error(`Sendcloud API error: ${response.status} - ${error}`)
  }

  const data: SendcloudResponse = await response.json()

  console.log(`[Sendcloud API] Response: ${data.parcels.length} parcels, next=${data.next ? 'YES' : 'NO'}`)

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
  console.log(`[Sendcloud fetchAll] Starting fetch: since=${since || 'NONE'}, maxPages=${maxPages}`)

  const allParcels: ParsedShipment[] = []
  let cursor: string | undefined
  let page = 0

  while (page < maxPages) {
    console.log(`[Sendcloud fetchAll] Fetching page ${page + 1}/${maxPages}...`)
    const { parcels, nextCursor } = await fetchParcels(credentials, {
      since,
      cursor,
      limit: 100,
    })

    allParcels.push(...parcels)
    console.log(`[Sendcloud fetchAll] Page ${page + 1}: got ${parcels.length} parcels, total so far: ${allParcels.length}`)

    if (!nextCursor || parcels.length === 0) {
      console.log(`[Sendcloud fetchAll] Stopping: ${!nextCursor ? 'no more pages' : 'empty page'}`)
      break
    }

    cursor = nextCursor
    page++
  }

  console.log(`[Sendcloud fetchAll] Complete: ${allParcels.length} total parcels from ${page + 1} pages`)
  return allParcels
}

// ============================================
// INTEGRATION SHIPMENTS (Orders "On Hold")
// ============================================

interface SendcloudIntegration {
  id: number
  shop_name: string
  system: string
}

interface SendcloudIntegrationShipment {
  shipment_uuid: string
  order_number: string
  external_order_id?: string
  name: string
  email?: string
  telephone?: string
  company_name?: string
  address: string
  address_2?: string
  house_number?: string
  city: string
  postal_code: string
  country: string
  order_status: { id: string; message: string }
  payment_status?: { id: string; message: string }
  shipping_method?: number
  shipping_method_checkout_name?: string
  to_service_point?: number
  total_order_value?: string
  currency?: string
  created_at: string
  updated_at?: string
  parcel_items?: Array<{
    sku?: string
    description: string
    quantity: number
    weight?: string
    value?: string
  }>
  // Error fields from Sendcloud
  errors?: Record<string, string[]>
  warnings?: string[]
  checkout_payload_errors?: string[]
}

interface SendcloudIntegrationShipmentsResponse {
  next: string | null
  previous: string | null
  results: SendcloudIntegrationShipment[]
}

/**
 * Get all integrations for the account
 */
export async function fetchIntegrations(
  credentials: SendcloudCredentials
): Promise<SendcloudIntegration[]> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return []
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')

  const response = await fetch(`${SENDCLOUD_API_URL}/integrations`, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    console.error(`[Sendcloud] Failed to fetch integrations: ${response.status}`)
    return []
  }

  return response.json()
}

/**
 * Parse an integration shipment to our ParsedShipment format
 */
function parseIntegrationShipment(shipment: SendcloudIntegrationShipment): ParsedShipment {
  const weightGrams = shipment.parcel_items?.reduce((sum, item) => {
    const w = parseFloat(item.weight || '0') * 1000
    return sum + (w * item.quantity)
  }, 0) || 0

  const items = shipment.parcel_items?.map(item => ({
    sku_code: item.sku || item.description,
    qty: item.quantity,
    description: item.description,
    value: item.value ? parseFloat(item.value) : undefined,
  })).filter(item => item.sku_code)

  // Error detection for integration shipments
  const orderStatusId = shipment.order_status?.id?.toLowerCase() || ''
  const orderStatusMsg = shipment.order_status?.message || ''

  const hasStatusError = orderStatusId.includes('error') ||
                         orderStatusId.includes('failed') ||
                         orderStatusMsg.toLowerCase().includes('error') ||
                         orderStatusMsg.toLowerCase().includes('erreur')

  const hasFieldErrors = shipment.errors && Object.keys(shipment.errors).length > 0
  const hasCheckoutErrors = shipment.checkout_payload_errors && shipment.checkout_payload_errors.length > 0

  const has_error = hasStatusError || !!hasFieldErrors || !!hasCheckoutErrors
  let error_message: string | null = null

  if (hasFieldErrors && shipment.errors) {
    error_message = Object.entries(shipment.errors)
      .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
      .join('; ')
  } else if (hasCheckoutErrors && shipment.checkout_payload_errors) {
    error_message = shipment.checkout_payload_errors.join('; ')
  } else if (hasStatusError) {
    error_message = orderStatusMsg || 'Erreur de validation'
  }

  return {
    sendcloud_id: shipment.shipment_uuid, // Use UUID as unique ID for pending orders
    shipped_at: shipment.created_at,
    carrier: shipment.shipping_method_checkout_name || 'pending',
    service: shipment.shipping_method_checkout_name || null,
    weight_grams: Math.round(weightGrams),
    order_ref: shipment.order_number,
    tracking: null, // No tracking yet for pending orders
    raw_json: shipment as unknown as Record<string, unknown>,
    recipient_name: shipment.name,
    recipient_email: shipment.email || null,
    recipient_phone: shipment.telephone || null,
    recipient_company: shipment.company_name || null,
    address_line1: shipment.address,
    address_line2: shipment.address_2 || null,
    city: shipment.city,
    postal_code: shipment.postal_code,
    country_code: shipment.country,
    country_name: null,
    status_id: null,
    status_message: shipment.order_status.message, // "On Hold", "Ready to process", etc.
    tracking_url: null,
    label_url: null,
    total_value: shipment.total_order_value ? parseFloat(shipment.total_order_value) : null,
    currency: shipment.currency || 'EUR',
    service_point_id: shipment.to_service_point ? String(shipment.to_service_point) : null,
    is_return: false,
    collo_count: 1,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    external_order_id: shipment.external_order_id || null,
    date_created: shipment.created_at,
    date_updated: shipment.updated_at || null,
    date_announced: null,
    items: items?.length ? items : undefined,
    // Error detection fields
    has_error,
    error_message,
  }
}

/**
 * Fetch shipments from a specific integration (pending orders)
 */
export async function fetchIntegrationShipments(
  credentials: SendcloudCredentials,
  integrationId: number,
  maxPages: number = 10
): Promise<ParsedShipment[]> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return []
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')
  const allShipments: ParsedShipment[] = []
  let nextUrl: string | null = `${SENDCLOUD_API_URL}/integrations/${integrationId}/shipments?limit=100`
  let page = 0

  console.log(`[Sendcloud] Fetching shipments from integration ${integrationId}`)

  while (nextUrl && page < maxPages) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`[Sendcloud] Failed to fetch integration shipments: ${response.status}`)
      break
    }

    const data: SendcloudIntegrationShipmentsResponse = await response.json()
    const parsed = data.results.map(parseIntegrationShipment)
    allShipments.push(...parsed)

    console.log(`[Sendcloud] Integration ${integrationId} page ${page + 1}: ${data.results.length} shipments`)

    nextUrl = data.next
    page++
  }

  console.log(`[Sendcloud] Integration ${integrationId}: ${allShipments.length} total shipments`)
  return allShipments
}

/**
 * Fetch all pending orders from all integrations
 */
export async function fetchAllIntegrationShipments(
  credentials: SendcloudCredentials,
  maxPagesPerIntegration: number = 5
): Promise<ParsedShipment[]> {
  const integrations = await fetchIntegrations(credentials)
  console.log(`[Sendcloud] Found ${integrations.length} integrations`)

  const allShipments: ParsedShipment[] = []

  for (const integration of integrations) {
    // Skip API integrations (like our own MLC Inventory)
    if (integration.system === 'api') {
      console.log(`[Sendcloud] Skipping API integration: ${integration.shop_name}`)
      continue
    }

    const shipments = await fetchIntegrationShipments(credentials, integration.id, maxPagesPerIntegration)
    allShipments.push(...shipments)
  }

  return allShipments
}

// ============================================
// WRITE OPERATIONS (App → Sendcloud)
// ============================================

export interface CreateParcelData {
  name: string
  address: string
  address_2?: string
  city: string
  postal_code: string
  country: string // ISO 2 code (FR, BE, etc.)
  telephone?: string
  email?: string
  company_name?: string
  order_number?: string
  weight: string // in kg
  shipment_id?: number // shipping method ID
  request_label?: boolean
  parcel_items?: Array<{
    description: string
    sku?: string
    quantity: number
    weight: string
    value: string
  }>
}

export interface SendcloudApiResponse {
  parcel?: SendcloudParcel
  parcels?: SendcloudParcel[]
  error?: {
    message: string
    code: number
  }
}

/**
 * Create a parcel in Sendcloud
 */
export async function createParcel(
  credentials: SendcloudCredentials,
  data: CreateParcelData
): Promise<{ success: boolean; parcel?: ParsedShipment; error?: string }> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return { success: false, error: 'Cannot create parcels in mock mode' }
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')

  try {
    const response = await fetch(`${SENDCLOUD_API_URL}/parcels`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcel: {
          ...data,
          request_label: data.request_label ?? false,
        },
      }),
    })

    const result: SendcloudApiResponse = await response.json()

    if (!response.ok || result.error) {
      return {
        success: false,
        error: result.error?.message || `Sendcloud API error: ${response.status}`,
      }
    }

    if (result.parcel) {
      return {
        success: true,
        parcel: parseParcel(result.parcel),
      }
    }

    return { success: false, error: 'No parcel returned from Sendcloud' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export interface UpdateParcelData {
  name?: string
  address?: string
  address_2?: string
  city?: string
  postal_code?: string
  country?: string
  telephone?: string
  email?: string
  company_name?: string
  order_number?: string
  weight?: string // in kg
  parcel_items?: Array<{
    description: string
    sku?: string
    quantity: number
    weight: string
    value: string
  }>
}

/**
 * Update a parcel in Sendcloud
 * Note: Only works for parcels that haven't been shipped yet (status_id < 1000)
 */
export async function updateParcel(
  credentials: SendcloudCredentials,
  sendcloudId: string,
  data: UpdateParcelData
): Promise<{ success: boolean; parcel?: ParsedShipment; error?: string }> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return { success: false, error: 'Cannot update parcels in mock mode' }
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')

  try {
    const response = await fetch(`${SENDCLOUD_API_URL}/parcels/${sendcloudId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcel: data,
      }),
    })

    const result: SendcloudApiResponse = await response.json()

    if (!response.ok || result.error) {
      return {
        success: false,
        error: result.error?.message || `Sendcloud API error: ${response.status}`,
      }
    }

    if (result.parcel) {
      return {
        success: true,
        parcel: parseParcel(result.parcel),
      }
    }

    return { success: false, error: 'No parcel returned from Sendcloud' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Cancel a parcel in Sendcloud
 * Note: Only works for parcels that haven't been shipped yet
 */
export async function cancelParcel(
  credentials: SendcloudCredentials,
  sendcloudId: string
): Promise<{ success: boolean; error?: string }> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return { success: false, error: 'Cannot cancel parcels in mock mode' }
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')

  try {
    const response = await fetch(`${SENDCLOUD_API_URL}/parcels/${sendcloudId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      return { success: true }
    }

    const result = await response.json()
    return {
      success: false,
      error: result.error?.message || `Sendcloud API error: ${response.status}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if a string is a UUID (integration shipment) vs numeric ID (parcel)
 */
function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Get a single parcel from Sendcloud
 */
export async function getParcel(
  credentials: SendcloudCredentials,
  sendcloudId: string
): Promise<{ success: boolean; parcel?: ParsedShipment; error?: string }> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return { success: false, error: 'Cannot get parcel in mock mode' }
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')

  try {
    const response = await fetch(`${SENDCLOUD_API_URL}/parcels/${sendcloudId}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    const result: SendcloudApiResponse = await response.json()

    if (!response.ok || result.error) {
      return {
        success: false,
        error: result.error?.message || `Sendcloud API error: ${response.status}`,
      }
    }

    if (result.parcel) {
      return {
        success: true,
        parcel: parseParcel(result.parcel),
      }
    }

    return { success: false, error: 'No parcel returned from Sendcloud' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get a single integration shipment by UUID
 * Searches across all integrations to find the shipment
 */
export async function getIntegrationShipment(
  credentials: SendcloudCredentials,
  shipmentUuid: string
): Promise<{ success: boolean; parcel?: ParsedShipment; error?: string }> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return { success: false, error: 'Cannot get shipment in mock mode' }
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')

  try {
    // Get all integrations
    const integrations = await fetchIntegrations(credentials)

    for (const integration of integrations) {
      if (integration.system === 'api') continue

      // Try to fetch the specific shipment from this integration
      const response = await fetch(
        `${SENDCLOUD_API_URL}/integrations/${integration.id}/shipments/${shipmentUuid}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const data: SendcloudIntegrationShipment = await response.json()
        return {
          success: true,
          parcel: parseIntegrationShipment(data),
        }
      }
    }

    return { success: false, error: 'Integration shipment not found' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get a shipment from Sendcloud (handles both parcels and integration shipments)
 */
export async function getShipment(
  credentials: SendcloudCredentials,
  sendcloudId: string
): Promise<{ success: boolean; parcel?: ParsedShipment; error?: string }> {
  // If it's a UUID, it's an integration shipment
  if (isUUID(sendcloudId)) {
    return getIntegrationShipment(credentials, sendcloudId)
  }
  // Otherwise it's a parcel
  return getParcel(credentials, sendcloudId)
}

// ============================================
// RETURNS OPERATIONS
// ============================================

/**
 * Map Sendcloud return status to our status
 */
function mapReturnStatus(statusId: number): string {
  // Based on Sendcloud status IDs for returns
  const statusMap: Record<number, string> = {
    1: 'announced',      // Announced / Created
    2: 'ready',          // Ready to send
    3: 'in_transit',     // In transit
    4: 'delivered',      // Delivered
    5: 'cancelled',      // Cancelled
    6: 'at_carrier',     // At carrier
    1000: 'announced',   // Default
    2000: 'ready',
    3000: 'in_transit',
    4000: 'delivered',
  }
  return statusMap[statusId] || 'announced'
}

/**
 * Map return reason from Sendcloud
 * Handles various formats from API including:
 * - { reason: "..." }
 * - { refund: { refund_type: { code: "money", label: "Money back" } } }
 */
function mapReturnReason(reason?: unknown, refundObj?: unknown): string | null {
  // Extract string from nested object structures
  const extractString = (val: unknown): string => {
    if (!val) return ''
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>
      // Handle nested structures like { refund_type: { code: "money", label: "..." } }
      if (obj.refund_type && typeof obj.refund_type === 'object') {
        const rt = obj.refund_type as Record<string, unknown>
        return String(rt.code || rt.label || '')
      }
      // Handle direct properties
      return String(obj.message || obj.code || obj.label || obj.reason || obj.name || '')
    }
    return String(val)
  }

  const reasonStr = extractString(reason)
  const refundStr = extractString(refundObj)

  if (!reasonStr && !refundStr) return null

  const combined = (reasonStr + ' ' + refundStr).toLowerCase()

  // Map to our return reason types
  if (combined.includes('money') || combined.includes('remboursement') || combined.includes('refund')) return 'refund'
  if (combined.includes('échange') || combined.includes('exchange') || combined.includes('replace')) return 'exchange'
  if (combined.includes('défectueux') || combined.includes('defect') || combined.includes('broken')) return 'defective'
  if (combined.includes('erreur') || combined.includes('wrong')) return 'wrong_item'

  return 'other'
}

/**
 * Parse a Sendcloud return object
 * Note: incoming_parcel is just an ID, actual data is in incoming_parcel_data
 */
export function parseReturn(ret: SendcloudReturn): ParsedReturn {
  const incomingData = ret.incoming_parcel_data
  const outgoingData = ret.outgoing_parcel_data
  const incomingStatus = ret.incoming_parcel_status

  // Map status - can be string "open"/"closed" or object with id/message
  let status = 'announced'
  let statusMessage: string | null = null

  if (typeof ret.status === 'string') {
    // String status like "open", "closed"
    const statusStr = ret.status.toLowerCase()
    if (statusStr === 'open') status = 'announced'
    else if (statusStr === 'closed') status = 'delivered'
    else if (statusStr === 'cancelled') status = 'cancelled'
    statusMessage = ret.status
  } else if (ret.status && typeof ret.status === 'object') {
    status = mapReturnStatus(ret.status.id)
    statusMessage = ret.status.message
  }

  // Also check incoming_parcel_status
  if (incomingStatus) {
    status = mapReturnStatus(incomingStatus.id)
    statusMessage = incomingStatus.message
  }

  // Check global_status_slug for more accurate status
  if (incomingData?.global_status_slug) {
    const slug = incomingData.global_status_slug.toLowerCase()
    if (slug.includes('transit')) status = 'in_transit'
    else if (slug.includes('delivered')) status = 'delivered'
    else if (slug.includes('announced')) status = 'announced'
    else if (slug.includes('ready')) status = 'ready'
  }

  return {
    sendcloud_id: String(ret.incoming_parcel),
    sendcloud_return_id: String(ret.id),
    order_ref: incomingData?.order_number || outgoingData?.order_number || null,
    tracking_number: incomingData?.tracking_number || null,
    tracking_url: incomingData?.tracking_url || null,
    carrier: null, // Not directly available, could be derived from shipping_method
    service: null,
    status,
    status_message: statusMessage,
    sender_name: incomingData?.from_name || null,
    sender_email: incomingData?.from_email || null,
    sender_phone: incomingData?.from_telephone || null,
    sender_company: incomingData?.from_company_name || null,
    sender_address: [incomingData?.from_address_1, incomingData?.from_address_2].filter(Boolean).join(', ') || null,
    sender_city: incomingData?.from_city || null,
    sender_postal_code: incomingData?.from_postal_code || null,
    sender_country_code: incomingData?.from_country || null,
    return_reason: mapReturnReason(ret.reason, ret.refund),
    return_reason_comment: ret.message || null,
    created_at: ret.created_at || new Date().toISOString(),
    announced_at: null, // Not available in this format
    raw_json: ret as unknown as Record<string, unknown>,
  }
}

/**
 * Fetch returns from Sendcloud
 */
export async function fetchReturns(
  credentials: SendcloudCredentials,
  options?: {
    since?: string
    limit?: number
    cursor?: string
  }
): Promise<{ returns: ParsedReturn[]; nextCursor?: string }> {
  // Mock mode doesn't support returns yet
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return { returns: [] }
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

  const url = `${SENDCLOUD_API_URL}/returns?${params.toString()}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Sendcloud Returns API error: ${response.status} - ${error}`)
  }

  const data: SendcloudReturnsResponse = await response.json()

  const returns = data.returns.map(parseReturn)

  // Extract cursor from next URL if present
  let nextCursor: string | undefined
  if (data.next) {
    const nextUrl = new URL(data.next)
    nextCursor = nextUrl.searchParams.get('cursor') || undefined
  }

  return { returns, nextCursor }
}

/**
 * Fetch all returns from Sendcloud (with pagination)
 */
export async function fetchAllReturns(
  credentials: SendcloudCredentials,
  since?: string,
  maxPages: number = 50
): Promise<ParsedReturn[]> {
  const allReturns: ParsedReturn[] = []
  let cursor: string | undefined
  let page = 0

  while (page < maxPages) {
    const { returns, nextCursor } = await fetchReturns(credentials, {
      since,
      cursor,
      limit: 100,
    })

    allReturns.push(...returns)

    if (!nextCursor || returns.length === 0) {
      break
    }

    cursor = nextCursor
    page++
  }

  return allReturns
}

/**
 * Get a single return from Sendcloud
 */
export async function getReturn(
  credentials: SendcloudCredentials,
  returnId: string
): Promise<{ success: boolean; return?: ParsedReturn; error?: string }> {
  if (process.env.SENDCLOUD_USE_MOCK === 'true') {
    return { success: false, error: 'Cannot get return in mock mode' }
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')

  try {
    const response = await fetch(`${SENDCLOUD_API_URL}/returns/${returnId}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return {
        success: false,
        error: `Sendcloud API error: ${response.status} - ${error}`,
      }
    }

    const data = await response.json()

    if (data) {
      return {
        success: true,
        return: parseReturn(data),
      }
    }

    return { success: false, error: 'No return data from Sendcloud' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
