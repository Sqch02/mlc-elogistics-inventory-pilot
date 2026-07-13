import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sendcloud/client', () => ({
  fetchAllParcels: vi.fn(),
  fetchAllIntegrationShipments: vi.fn(),
  fetchAllReturns: vi.fn(),
}))

import { fetchCronData, refreshCronAnalytics } from './route'
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

    expect(mockFetchAllParcels).toHaveBeenCalledWith(credentials, since, 10)
    expect(mockFetchAllIntegrationShipments).toHaveBeenCalledWith(credentials, 10)
    expect(mockFetchAllReturns).toHaveBeenCalledWith(credentials, since, 10)
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
