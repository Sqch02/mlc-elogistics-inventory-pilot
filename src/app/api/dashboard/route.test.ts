import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/fast-auth', () => ({
  getFastUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/untyped', () => ({
  getServerDb: vi.fn(),
}))

vi.mock('@/lib/utils/stock', () => ({
  calculateSKUMetrics: vi.fn().mockResolvedValue([]),
}))

import { GET } from './route'
import { getFastUser } from '@/lib/supabase/fast-auth'
import { createClient } from '@/lib/supabase/server'
import { getServerDb } from '@/lib/supabase/untyped'

const mockGetFastUser = getFastUser as ReturnType<typeof vi.fn>
const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockGetServerDb = getServerDb as ReturnType<typeof vi.fn>

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  tenant_id: 'test-tenant-id',
}

// Create mock Supabase client for dashboard queries
function createMockDashboardClient() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 }),
    }),
    rpc: vi.fn().mockReturnValue({
      then: (resolve: (value: unknown) => void) => resolve({ data: [{ total_indemnity: 0 }], error: null }),
    }),
  }
}

function createRequest(params?: Record<string, string>): NextRequest {
  let url = 'http://localhost:3000/api/dashboard'
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }
  return new NextRequest(url)
}

describe('GET /api/dashboard', () => {
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
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())

      expect(response.status).toBe(200)
    })
  })

  describe('data structure', () => {
    it('should return KPIs', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.kpis).toBeDefined()
      expect(data.kpis.shipments).toBeDefined()
      expect(data.kpis.cost).toBeDefined()
      expect(data.kpis.missingPricing).toBeDefined()
    })

    it('should return chart data', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.chartData).toBeDefined()
      expect(Array.isArray(data.chartData)).toBe(true)
    })

    it('should return stock health data', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.stockHealth).toBeDefined()
      expect(Array.isArray(data.stockHealth)).toBe(true)
    })

    it('should return alerts array', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.alerts).toBeDefined()
      expect(Array.isArray(data.alerts)).toBe(true)
    })

    it('should return billing status', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.billing).toBeDefined()
      expect(data.billing.status).toBeDefined()
    })

    it('should return current month', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.currentMonth).toBeDefined()
      expect(data.currentMonth).toMatch(/^\d{4}-\d{2}$/)
    })
  })

  describe('month parameter', () => {
    it('should accept month parameter', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest({ month: '2024-01' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.currentMonth).toBe('2024-01')
    })

    it('should default to current month if no parameter', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.currentMonth).toBeDefined()
    })

    it('should ignore invalid month format', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest({ month: 'invalid' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should default to current month
      expect(data.currentMonth).toMatch(/^\d{4}-\d{2}$/)
    })
  })

  describe('cache headers', () => {
    it('should include cache headers in response', async () => {
      mockGetFastUser.mockResolvedValue(mockUser)
      mockCreateClient.mockResolvedValue(createMockDashboardClient())
      mockGetServerDb.mockResolvedValue(createMockDashboardClient())

      const response = await GET(createRequest())

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=60, stale-while-revalidate=300')
    })
  })
})
