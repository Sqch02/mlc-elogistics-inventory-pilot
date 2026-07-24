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
  it('refreshes only the light per-tick view', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })

    const result = await refreshCronAnalytics({ rpc })

    // Les deux vues lourdes sont passees sous pg_cron (migration 00099) : elles
    // ne pouvaient pas aboutir sous le statement_timeout de 8 s de PostgREST.
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['refresh_sku_metrics'])
    expect(result).toEqual({ refreshed: ['refresh_sku_metrics'], failed: [] })
  })

  it('reports the refresh as failed instead of throwing', async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error('network timeout'))

    const result = await refreshCronAnalytics({ rpc })

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ refreshed: [], failed: ['refresh_sku_metrics'] })
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
