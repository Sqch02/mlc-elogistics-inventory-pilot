import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAllIntegrationShipments,
  fetchAllParcels,
  fetchAllReturns,
} from './client'
import { SendcloudPaginationLimitError } from './pagination'

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
  })

  it('fails instead of returning a silently truncated parcel batch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      parcels: [rawParcel(1)],
      next: 'https://panel.sendcloud.sc/api/v2/parcels?cursor=page-2',
    })))

    await expect(fetchAllParcels(credentials, undefined, 1)).rejects.toEqual(
      expect.objectContaining<Partial<SendcloudPaginationLimitError>>({
        name: 'SendcloudPaginationLimitError',
        resource: 'parcels',
        maxPages: 1,
      }),
    )
  })

  it('keeps a bounded integration snapshot without failing the tenant sync', async () => {
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

    const shipments = await fetchAllIntegrationShipments(credentials, 1)

    expect(shipments.map((shipment) => shipment.sendcloud_id)).toEqual([
      'shipment-1',
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails instead of returning a silently truncated returns batch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      returns: [{
        id: 9,
        created_at: '2026-07-13T09:00:00.000Z',
        status: 'open',
        incoming_parcel: 123,
      }],
      next: 'https://panel.sendcloud.sc/api/v2/returns?cursor=page-2',
    })))

    await expect(fetchAllReturns(credentials, undefined, 1)).rejects.toEqual(
      expect.objectContaining<Partial<SendcloudPaginationLimitError>>({
        name: 'SendcloudPaginationLimitError',
        resource: 'returns',
        maxPages: 1,
      }),
    )
  })
})
