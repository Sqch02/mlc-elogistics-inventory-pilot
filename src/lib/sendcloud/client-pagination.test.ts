import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAllIntegrationShipments,
  fetchAllParcels,
  fetchAllReturns,
  parseParcel,
} from './client'
import type { SendcloudParcel } from './types'

const credentials = { apiKey: 'test-key', secret: 'test-secret' }

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function rawParcel(id: number) {
  return {
    id,
    tracking_number: `TRACK-${id}`,
    carrier: { code: 'colissimo' },
    name: 'Test Recipient',
    address: '1 rue du Test',
    city: 'Paris',
    postal_code: '75001',
    country: { iso_2: 'FR', name: 'France' },
    weight: '0.5',
    order_number: `ORDER-${id}`,
    shipment: { id: 1, name: 'Colissimo' },
    status: { id: 11, message: 'Ready' },
    created_at: '2026-07-13T09:00:00.000Z',
    date_created: '2026-07-13T09:00:00.000Z',
    date_updated: '2026-07-13T09:05:00.000Z',
    date_announced: null,
    updated_at: '2026-07-13T09:05:00.000Z',
  }
}

function integrationShipment(id: string) {
  return {
    shipment_uuid: id,
    order_number: `ORDER-${id}`,
    name: 'Test Recipient',
    address: '1 rue du Test',
    city: 'Paris',
    postal_code: '75001',
    country: 'FR',
    order_status: { id: 'on_hold', message: 'On Hold' },
    created_at: '2026-07-13T09:00:00.000Z',
  }
}

describe('Sendcloud pagination completion', () => {
  const originalMockMode = process.env.SENDCLOUD_USE_MOCK

  beforeEach(() => {
    process.env.SENDCLOUD_USE_MOCK = 'false'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env.SENDCLOUD_USE_MOCK = originalMockMode
  })

  it('fetches parcel pages until Sendcloud reports completion', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        parcels: [rawParcel(1)],
        next: 'https://panel.sendcloud.sc/api/v2/parcels?cursor=page-2',
      }))
      .mockResolvedValueOnce(jsonResponse({
        parcels: [rawParcel(2)],
        next: null,
      }))
    vi.stubGlobal('fetch', fetchMock)

    const parcels = await fetchAllParcels(
      credentials,
      '2026-07-13T08:00:00.000Z',
      2,
    )

    expect(parcels.map((parcel) => parcel.sendcloud_id)).toEqual(['1', '2'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const [requestUrl] of fetchMock.mock.calls) {
      expect(new URL(String(requestUrl)).searchParams.get('errors')).toBe('verbose-carrier')
    }
  })

  it('does not classify 1002 without a verbose carrier cause', () => {
    const parsed = parseParcel({
      ...rawParcel(1002),
      status: { id: 1002, message: 'Announcement failed' },
    } as SendcloudParcel)
    expect(parsed.has_error).toBe(false)
    expect(parsed.error_message).toBeNull()
  })

  it('ingests structured parcel causes returned by errors=verbose-carrier', () => {
    const parsed = parseParcel({
      ...rawParcel(1002),
      status: { id: 1002, message: 'Announcement failed' },
      errors: { address: ['Address too long'] },
    } as SendcloudParcel)
    expect(parsed.has_error).toBe(true)
    expect(parsed.error_message).toContain('address: Address too long')
  })

  it('caps a truncated parcel batch loudly instead of failing the tenant sync', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onPaginationCap = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      parcels: [rawParcel(1)],
      next: 'https://panel.sendcloud.sc/api/v2/parcels?cursor=page-2',
    })))

    // A throw here would fail the whole tenant sync AND deadlock a high-volume
    // tenant whose incremental window never fits in the page budget (Florna,
    // 13/07). The fetch must instead cap and log LOUDLY (no SILENT truncation).
    const parcels = await fetchAllParcels(
      credentials,
      undefined,
      1,
      onPaginationCap,
    )

    expect(parcels.map((parcel) => parcel.sendcloud_id)).toEqual(['1'])
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('parcels still has data after 1 pages'),
    )
    expect(onPaginationCap).toHaveBeenCalledWith({
      resource: 'parcels',
      fetched: 1,
      maxPages: 1,
    })
    warnSpy.mockRestore()
  })

  it('keeps a bounded integration snapshot without failing the tenant sync', async () => {
    const onPaginationCap = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        { id: 7, shop_name: 'Shopify', system: 'shopify' },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        results: [integrationShipment('shipment-1')],
        previous: null,
        next: 'https://panel.sendcloud.sc/api/v2/integrations/7/shipments?page=2',
      }))
    vi.stubGlobal('fetch', fetchMock)

    const shipments = await fetchAllIntegrationShipments(
      credentials,
      1,
      onPaginationCap,
    )

    expect(shipments.map((shipment) => shipment.sendcloud_id)).toEqual([
      'shipment-1',
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onPaginationCap).toHaveBeenCalledWith({
      resource: 'integration_shipments',
      fetched: 1,
      maxPages: 1,
      integrationId: 7,
    })
  })

  it('marks integration shipments only from blocking structured collections', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 7, shop_name: 'Shopify', system: 'shopify' }]))
      .mockResolvedValueOnce(jsonResponse({
        results: [{
          ...integrationShipment('shipment-error'),
          warnings: ['On Hold'],
          checkout_payload_errors: { address_2: ['Address too long'] },
        }],
        previous: null,
        next: null,
      }))
    vi.stubGlobal('fetch', fetchMock)

    const [parsed] = await fetchAllIntegrationShipments(credentials, 1)
    expect(parsed.has_error).toBe(true)
    expect(parsed.error_message).toContain('address_2: Address too long')
  })

  it('caps a truncated returns batch loudly instead of failing the tenant sync', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onPaginationCap = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      returns: [{
        id: 9,
        created_at: '2026-07-13T09:00:00.000Z',
        status: 'open',
        incoming_parcel: 123,
      }],
      next: 'https://panel.sendcloud.sc/api/v2/returns?cursor=page-2',
    })))

    const returns = await fetchAllReturns(
      credentials,
      undefined,
      1,
      onPaginationCap,
    )

    expect(Array.isArray(returns)).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('returns still has data after 1 pages'),
    )
    expect(onPaginationCap).toHaveBeenCalledWith({
      resource: 'returns',
      fetched: 1,
      maxPages: 1,
    })
    warnSpy.mockRestore()
  })
})
