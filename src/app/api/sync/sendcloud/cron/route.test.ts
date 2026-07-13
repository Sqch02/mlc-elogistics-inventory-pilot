import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sendcloud/client', () => ({
  fetchAllParcels: vi.fn(),
  fetchAllIntegrationShipments: vi.fn(),
  fetchAllReturns: vi.fn(),
}))

import { fetchCronData } from './route'
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
