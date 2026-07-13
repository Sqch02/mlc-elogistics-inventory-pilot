import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedShipment } from '@/lib/sendcloud/types'

vi.mock('@/lib/supabase/auth', () => ({
  requireTenant: vi.fn(),
}))

vi.mock('@/lib/supabase/untyped', () => ({
  getAdminDb: vi.fn(),
}))

vi.mock('@/lib/sendcloud/client', () => ({
  fetchAllParcels: vi.fn(),
}))

vi.mock('@/lib/utils/sku-mapping', () => ({
  processShipmentItems: vi.fn(),
}))

vi.mock('@/lib/stock/consume', () => ({
  consumeShipmentStockOnce: vi.fn(),
}))

import { POST } from './route'
import { fetchAllParcels } from '@/lib/sendcloud/client'
import { consumeShipmentStockOnce } from '@/lib/stock/consume'
import { requireTenant } from '@/lib/supabase/auth'
import { getAdminDb } from '@/lib/supabase/untyped'
import { processShipmentItems } from '@/lib/utils/sku-mapping'

const mockFetchAllParcels = vi.mocked(fetchAllParcels)
const mockConsumeShipmentStockOnce = vi.mocked(consumeShipmentStockOnce)
const mockRequireTenant = vi.mocked(requireTenant)
const mockGetAdminDb = vi.mocked(getAdminDb)
const mockProcessShipmentItems = vi.mocked(processShipmentItems)

interface PricingRuleFixture {
  carrier: string
  destination: string
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

interface AdminClientOptions {
  existingShipment?: { id: string } | null
  pricingRules?: PricingRuleFixture[]
  shipmentError?: { message: string } | null
}

interface AwaitableChain {
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (
    resolve: (value: { data: unknown; error: null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>
}

function makeAwaitable(data: unknown, singleData: unknown = data) {
  const chain = {} as AwaitableChain
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.single = vi.fn().mockResolvedValue({ data: singleData, error: null })
  chain.then = (
    resolve: (value: { data: unknown; error: null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve({ data, error: null }).then(resolve, reject)
  return chain
}

function createAdminClient(options: AdminClientOptions = {}) {
  const {
    existingShipment = null,
    pricingRules = [],
    shipmentError = null,
  } = options

  const syncRunUpdates: Array<Record<string, unknown>> = []
  const shipmentUpserts: Array<Record<string, unknown>> = []

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'sync_runs') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'sync-run-1' },
                error: null,
              }),
            })),
          })),
          select: vi.fn(() => makeAwaitable(
            null,
            { cursor: '2026-07-13T08:00:00.000Z', ended_at: null },
          )),
          update: vi.fn((payload: Record<string, unknown>) => {
            syncRunUpdates.push(payload)
            return makeAwaitable(null)
          }),
        }
      }

      if (table === 'tenant_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  sendcloud_api_key: 'tenant-api-key',
                  sendcloud_secret: 'tenant-secret',
                },
                error: null,
              }),
            })),
          })),
        }
      }

      if (table === 'pricing_rules') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => makeAwaitable(pricingRules)),
            })),
          })),
        }
      }

      if (table === 'shipments') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: existingShipment,
                error: null,
              }),
            })),
          })),
          upsert: vi.fn((payload: Record<string, unknown>) => {
            shipmentUpserts.push(payload)
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: shipmentError ? null : { id: 'shipment-1' },
                  error: shipmentError,
                }),
              })),
            }
          }),
        }
      }

      throw new Error(`Unexpected table in test: ${table}`)
    }),
  }

  return { client, shipmentUpserts, syncRunUpdates }
}

function makeParcel(overrides: Partial<ParsedShipment> = {}): ParsedShipment {
  return {
    sendcloud_id: '12345',
    shipped_at: '2026-07-13T09:00:00.000Z',
    carrier: 'Colissimo',
    service: 'Domicile',
    weight_grams: 500,
    order_ref: 'ORDER-42',
    tracking: 'TRACK-42',
    raw_json: {
      parcel_items: [{ sku: 'SKU-1', quantity: 2 }],
    },
    recipient_name: 'Client Test',
    recipient_email: null,
    recipient_phone: null,
    recipient_company: null,
    address_line1: '1 rue du Test',
    address_line2: null,
    house_number: '1',
    city: 'Paris',
    postal_code: '75001',
    country_code: 'FR',
    country_name: 'France',
    status_id: 11,
    status_message: 'Ready to send',
    tracking_url: null,
    label_url: null,
    total_value: 25,
    currency: 'EUR',
    service_point_id: null,
    is_return: false,
    collo_count: 1,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    external_order_id: null,
    date_created: '2026-07-13T09:00:00.000Z',
    date_updated: '2026-07-13T09:05:00.000Z',
    date_announced: null,
    has_error: false,
    error_message: null,
    ...overrides,
  }
}

describe('POST /api/sync/sendcloud/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireTenant.mockResolvedValue('tenant-1')
    mockProcessShipmentItems.mockResolvedValue({ mappedCount: 1, unmappedCount: 0 })
    mockConsumeShipmentStockOnce.mockResolvedValue({ consumed: true, count: 2 })
  })

  it('creates, prices, maps and consumes stock for a new shipment', async () => {
    const pricingRules: PricingRuleFixture[] = [
      {
        carrier: 'colissimo',
        destination: 'france_domicile',
        weight_min_grams: 0,
        weight_max_grams: 500,
        price_eur: 5.5,
      },
      {
        carrier: 'colissimo',
        destination: 'france_domicile',
        weight_min_grams: 500,
        weight_max_grams: 1000,
        price_eur: 7.5,
      },
    ]
    const { client, shipmentUpserts, syncRunUpdates } = createAdminClient({ pricingRules })
    const parcel = makeParcel()

    mockGetAdminDb.mockReturnValue(client as unknown as ReturnType<typeof getAdminDb>)
    mockFetchAllParcels.mockResolvedValue([parcel])

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats).toMatchObject({
      fetched: 1,
      created: 1,
      updated: 0,
      itemsCreated: 1,
      stockConsumed: 2,
      errors: [],
    })
    expect(mockFetchAllParcels).toHaveBeenCalledWith(
      { apiKey: 'tenant-api-key', secret: 'tenant-secret' },
      '2026-07-13T08:00:00.000Z',
    )
    expect(shipmentUpserts).toHaveLength(1)
    expect(shipmentUpserts[0]).toMatchObject({
      tenant_id: 'tenant-1',
      sendcloud_id: '12345',
      status_id: 11,
      pricing_status: 'ok',
      computed_cost_eur: 5.5,
    })
    expect(mockProcessShipmentItems).toHaveBeenCalledWith(
      client,
      'tenant-1',
      'shipment-1',
      [{ sku: 'SKU-1', quantity: 2 }],
    )
    expect(mockConsumeShipmentStockOnce).toHaveBeenCalledWith('tenant-1', 'shipment-1')
    expect(syncRunUpdates.at(-1)).toMatchObject({ status: 'success' })
  })

  it('updates an existing shipment without consuming its stock again', async () => {
    const { client, syncRunUpdates } = createAdminClient({
      existingShipment: { id: 'shipment-1' },
    })
    mockGetAdminDb.mockReturnValue(client as unknown as ReturnType<typeof getAdminDb>)
    mockFetchAllParcels.mockResolvedValue([makeParcel()])

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats).toMatchObject({ created: 0, updated: 1, stockConsumed: 0 })
    expect(mockProcessShipmentItems).toHaveBeenCalledTimes(1)
    expect(mockConsumeShipmentStockOnce).not.toHaveBeenCalled()
    expect(syncRunUpdates.at(-1)).toMatchObject({ status: 'success' })
  })

  it('marks the run partial and skips item processing when one shipment upsert fails', async () => {
    const { client, syncRunUpdates } = createAdminClient({
      shipmentError: { message: 'database unavailable' },
    })
    mockGetAdminDb.mockReturnValue(client as unknown as ReturnType<typeof getAdminDb>)
    mockFetchAllParcels.mockResolvedValue([makeParcel()])

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stats.created).toBe(0)
    expect(body.stats.errors).toEqual(['Shipment 12345: database unavailable'])
    expect(mockProcessShipmentItems).not.toHaveBeenCalled()
    expect(mockConsumeShipmentStockOnce).not.toHaveBeenCalled()
    expect(syncRunUpdates.at(-1)).toMatchObject({ status: 'partial' })
  })
  it('records the valid failed enum value when the Sendcloud fetch aborts', async () => {
    const { client, syncRunUpdates } = createAdminClient()
    mockGetAdminDb.mockReturnValue(client as unknown as ReturnType<typeof getAdminDb>)
    mockFetchAllParcels.mockRejectedValue(new Error('pagination limit reached'))

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({
      success: false,
      message: 'pagination limit reached',
    })
    expect(syncRunUpdates.at(-1)).toMatchObject({
      status: 'failed',
      error_text: 'pagination limit reached',
    })
  })
})
