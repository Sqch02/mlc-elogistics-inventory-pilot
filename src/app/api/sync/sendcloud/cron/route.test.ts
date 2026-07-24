import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sendcloud/client', () => ({
  fetchAllParcels: vi.fn(),
  fetchAllIntegrationShipments: vi.fn(),
  fetchAllReturns: vi.fn(),
}))

import { fetchCronData, overallRunStatus, refreshCronAnalytics } from './route'
import {
  fetchAllIntegrationShipments,
  fetchAllParcels,
  fetchAllReturns,
} from '@/lib/sendcloud/client'

const mockFetchAllParcels = vi.mocked(fetchAllParcels)
const mockFetchAllIntegrationShipments = vi.mocked(fetchAllIntegrationShipments)
const mockFetchAllReturns = vi.mocked(fetchAllReturns)

describe('fetchCronData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchAllParcels.mockResolvedValue([])
    mockFetchAllIntegrationShipments.mockResolvedValue([])
    mockFetchAllReturns.mockResolvedValue([])
  })

  it('applies the same bounded page budget to every Sendcloud resource', async () => {
    const credentials = { apiKey: 'tenant-key', secret: 'tenant-secret' }
    const since = '2026-07-13T08:00:00.000Z'

    await fetchCronData(credentials, since, 10)

    expect(mockFetchAllParcels).toHaveBeenCalledWith(credentials, since, 10, undefined)
    expect(mockFetchAllIntegrationShipments).toHaveBeenCalledWith(credentials, 10, undefined)
    expect(mockFetchAllReturns).toHaveBeenCalledWith(credentials, since, 10, undefined)
  })

  it('forwards pagination cap notices without changing fetched data', async () => {
    const credentials = { apiKey: 'tenant-key', secret: 'tenant-secret' }
    const since = '2026-07-13T08:00:00.000Z'
    const onPaginationCap = vi.fn()

    await fetchCronData(credentials, since, 2, onPaginationCap)

    expect(mockFetchAllParcels).toHaveBeenCalledWith(
      credentials,
      since,
      2,
      onPaginationCap,
    )
    expect(mockFetchAllIntegrationShipments).toHaveBeenCalledWith(
      credentials,
      2,
      onPaginationCap,
    )
    expect(mockFetchAllReturns).toHaveBeenCalledWith(
      credentials,
      since,
      2,
      onPaginationCap,
    )
  })
})

describe('refreshCronAnalytics', () => {
  it('refreshes each global view once in dependency order', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })

    const result = await refreshCronAnalytics({ rpc })

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'refresh_physical_items_view',
      'refresh_dashboard_daily',
      'refresh_sku_metrics',
    ])
    expect(result).toEqual({
      refreshed: [
        'refresh_physical_items_view',
        'refresh_dashboard_daily',
        'refresh_sku_metrics',
      ],
      failed: [],
    })
  })

  it('continues refreshing later views when one RPC times out', async () => {
    const rpc = vi.fn()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })

    const result = await refreshCronAnalytics({ rpc })

    expect(rpc).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      refreshed: ['refresh_dashboard_daily', 'refresh_sku_metrics'],
      failed: ['refresh_physical_items_view'],
    })
  })
})

describe('overallRunStatus', () => {
  const resource = (status: 'success' | 'partial' | 'failed') => ({
    status,
    fetched: 0,
    pages_fetched: 0,
    pagination_capped: status === 'partial',
    has_more: status === 'partial',
    resumed: false,
  })

  it('records a capped resource as a partial run', () => {
    expect(overallRunStatus({
      parcels: resource('success'),
      integration_shipments: resource('success'),
      returns: resource('partial'),
    })).toBe('partial')
  })

  it('records an entirely unavailable tenant sync as failed', () => {
    expect(overallRunStatus({
      parcels: resource('failed'),
      integration_shipments: resource('failed'),
      returns: resource('failed'),
    })).toBe('failed')
  })
})
