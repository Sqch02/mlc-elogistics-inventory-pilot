import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/fast-auth', () => ({
  getFastUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/utils/sanitize', () => ({
  sanitizeSearchInput: vi.fn((input: string) => input),
}))

import { GET } from './route'
import { getFastUser } from '@/lib/supabase/fast-auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockGetFastUser = getFastUser as ReturnType<typeof vi.fn>
const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  tenant_id: 'test-tenant-id',
}

// Create mock Supabase client for returns queries
function createMockReturnsClient(
  returnsData: unknown[] = [],
  count: number = 0,
  statsData: unknown[] = []
) {
  let callCount = 0
  return {
    from: vi.fn((table: string) => {
      if (table === 'returns') {
        callCount++
        // First call is for paginated returns, second for stats
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockReturnThis(),
            then: (resolve: (value: unknown) => void) => resolve({ data: returnsData, error: null, count }),
          }
        }
        // Stats query
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => void) => resolve({ data: statsData, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
      }
    }),
  }
}

// Create mock admin client for shipments enrichment
function createMockAdminClientForShipments(shipmentsData: unknown[] = []) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => void) => resolve({ data: shipmentsData, error: null }),
    }),
  }
}

function createRequest(params?: Record<string, string>): NextRequest {
  let url = 'http://localhost:3000/api/returns'
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }
  return new NextRequest(url)
}

describe('GET /api/returns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetFastUser.mockResolvedValue(null)

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Non authentifié')
    })

    it('should proceed if user is authenticated', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient())
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
    })
  })

  describe('data retrieval', () => {
    it('should return returns array', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient([
        { id: 'ret-1', sendcloud_id: 'sc-1', order_ref: '#123', status: 'announced' },
        { id: 'ret-2', sendcloud_id: 'sc-2', order_ref: '#456', status: 'in_transit' },
      ], 2))
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.returns).toBeDefined()
      expect(Array.isArray(data.returns)).toBe(true)
    })

    it('should return pagination info', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient([], 100))
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest({ page: '1', pageSize: '50' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.pageSize).toBe(50)
      expect(data.pagination.total).toBe(100)
      expect(data.pagination.totalPages).toBe(2)
    })

    it('should return stats', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient([], 0, [
        { status: 'announced', return_reason: 'refund' },
        { status: 'delivered', return_reason: 'defective' },
      ]))
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stats).toBeDefined()
      expect(data.stats.total).toBeDefined()
      expect(data.stats.byReason).toBeDefined()
    })
  })

  describe('filtering', () => {
    it('should accept status filter', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient([
        { id: 'ret-1', sendcloud_id: 'sc-1', status: 'announced' },
      ], 1))
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest({ status: 'announced' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.returns).toBeDefined()
    })

    it('should accept reason filter', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient([
        { id: 'ret-1', sendcloud_id: 'sc-1', return_reason: 'refund' },
      ], 1))
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest({ reason: 'refund' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.returns).toBeDefined()
    })

    it('should accept date range filters', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient([], 0))
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest({
        from: '2024-01-01',
        to: '2024-01-31',
      }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.returns).toBeDefined()
    })

    it('should accept search parameter', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient([
        { id: 'ret-1', sendcloud_id: 'sc-1', order_ref: '#123456' },
      ], 1))
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest({ search: '123456' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.returns).toBeDefined()
    })
  })

  describe('cache headers', () => {
    it('should include cache headers in response', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockReturnsClient())
      mockCreateAdminClient.mockReturnValue(createMockAdminClientForShipments())

      const response = await GET(createRequest())

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=30, stale-while-revalidate=60')
    })
  })
})
