import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock user
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  tenant_id: 'test-tenant-id',
  role: 'admin',
}

// Mock dependencies
vi.mock('@/lib/supabase/fast-auth', () => ({
  getFastUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/utils/stock', () => ({
  calculateSKUMetrics: vi.fn().mockResolvedValue([]),
  getCriticalStockThreshold: vi.fn().mockReturnValue(7),
}))

import { GET } from './route'
import { getFastUser } from '@/lib/supabase/fast-auth'
import { createClient } from '@/lib/supabase/server'

const mockGetFastUser = getFastUser as ReturnType<typeof vi.fn>
const mockCreateClient = createClient as ReturnType<typeof vi.fn>

function createRequest(params?: Record<string, string>): NextRequest {
  let url = 'http://localhost:3000/api/products'
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }
  return new NextRequest(url)
}

// Create mock Supabase client with chainable methods
function createMockSupabase(skusData: unknown[] = [], bundlesData: unknown[] = []) {
  const chainable = (data: unknown) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'skus') return chainable(skusData)
      if (table === 'bundles') return chainable(bundlesData)
      return chainable([])
    }),
  }
}

describe('GET /api/products', () => {
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
      mockCreateClient.mockResolvedValue(createMockSupabase())

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
    })
  })

  describe('data retrieval', () => {
    it('should return products array', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockSupabase([
        { id: '1', sku_code: 'SKU-001', name: 'Product 1', alert_threshold: 10 },
        { id: '2', sku_code: 'SKU-002', name: 'Product 2', alert_threshold: 20 },
      ]))

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.skus).toBeDefined()
      expect(Array.isArray(data.skus)).toBe(true)
    })

    it('should filter out bundle SKUs', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockSupabase(
        [
          { id: '1', sku_code: 'SKU-001', name: 'Product 1', alert_threshold: 10 },
          { id: '2', sku_code: 'BU-001', name: 'Bundle 1', alert_threshold: 10 },
        ],
        [{ bundle_sku_id: '2' }]
      ))

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should filter out BU- prefixed SKUs
      const hasBundleSku = data.skus.some((s: { sku_code: string }) => s.sku_code.includes('BU-'))
      expect(hasBundleSku).toBe(false)
    })
  })

  describe('search functionality', () => {
    it('should accept search parameter', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockSupabase([
        { id: '1', sku_code: 'FLRN-TEST', name: 'Test Product', alert_threshold: 10 },
      ]))

      const response = await GET(createRequest({ search: 'test' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.skus).toBeDefined()
    })

    it('should sanitize search input', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockSupabase())

      // Should not throw error with potentially dangerous input
      const response = await GET(createRequest({ search: 'test.eq.injection' }))

      expect(response.status).toBe(200)
    })
  })

  describe('status filtering', () => {
    it('should accept status parameter', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockSupabase([
        { id: '1', sku_code: 'SKU-001', name: 'Product 1', alert_threshold: 10 },
      ]))

      const response = await GET(createRequest({ status: 'critical' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.skus).toBeDefined()
    })
  })
})
