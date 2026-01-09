import type { SendcloudParcel, ParsedShipment } from './types'

// Generate mock shipments for testing
export function generateMockParcels(count: number = 10, since?: Date): SendcloudParcel[] {
  const carriers = ['colissimo', 'chronopost', 'dpd', 'ups', 'dhl']
  const services = ['Standard', 'Express', 'Economy', 'Premium']
  const statuses = [
    { id: 1000, message: 'Ready to send' },
    { id: 3, message: 'Delivered' },
    { id: 11, message: 'Announced' },
  ]

  const parcels: SendcloudParcel[] = []
  const baseDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate.getTime() + i * 3600 * 1000)
    const carrier = carriers[Math.floor(Math.random() * carriers.length)]
    const weight = (0.1 + Math.random() * 4.9).toFixed(2) // 0.1 - 5kg

    // Format date as Sendcloud format "DD-MM-YYYY HH:mm:ss"
    const formatSendcloudDate = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }

    parcels.push({
      id: 1000000 + i,
      tracking_number: `MOCK${Date.now()}${i}`,
      carrier: { code: carrier },
      name: `Client ${i + 1}`,
      address: `${i + 1} Rue de Test`,
      city: 'Paris',
      postal_code: '75001',
      country: { iso_2: 'FR', name: 'France' },
      weight,
      order_number: `ORD-MOCK-${String(i + 1).padStart(4, '0')}`,
      shipment: {
        id: 100 + i,
        name: services[Math.floor(Math.random() * services.length)],
      },
      status: statuses[Math.floor(Math.random() * statuses.length)],
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      date_created: formatSendcloudDate(date),
      date_updated: formatSendcloudDate(date),
      date_announced: formatSendcloudDate(date),
      parcel_items: Math.random() > 0.3 ? [
        {
          description: `Product ${i + 1}`,
          sku: `SKU-${String(i % 5 + 1).padStart(3, '0')}`,
          quantity: Math.floor(Math.random() * 3) + 1,
          weight: (parseFloat(weight) / 2).toFixed(2),
          value: (10 + Math.random() * 90).toFixed(2),
        },
      ] : undefined,
    })
  }

  return parcels
}

export function parseMockParcel(parcel: SendcloudParcel): ParsedShipment {
  // Convert weight from kg to grams
  const weightGrams = Math.round(parseFloat(parcel.weight) * 1000)

  // Extract items if available
  const items = parcel.parcel_items?.map((item) => ({
    sku_code: item.sku || item.description,
    qty: item.quantity,
  }))

  return {
    sendcloud_id: `MOCK-${parcel.id}`,
    shipped_at: parcel.created_at || new Date().toISOString(),
    carrier: parcel.carrier.code,
    service: parcel.shipment?.name || null,
    weight_grams: weightGrams,
    order_ref: parcel.order_number || null,
    tracking: parcel.tracking_number || null,
    raw_json: parcel as unknown as Record<string, unknown>,
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
    date_created: parcel.date_created,
    date_updated: parcel.date_updated,
    date_announced: parcel.date_announced,
    items: items?.length ? items : undefined,
  }
}

export async function fetchMockParcels(
  since?: string,
  _credentials?: { apiKey: string; secret: string }
): Promise<ParsedShipment[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  const sinceDate = since ? new Date(since) : undefined
  const mockParcels = generateMockParcels(5, sinceDate)

  return mockParcels.map(parseMockParcel)
}
