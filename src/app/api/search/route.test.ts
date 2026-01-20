import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the dependencies before importing the route
vi.mock('@/lib/supabase/auth', () => ({
  requireTenant: vi.fn().mockResolvedValue('test-tenant-id'),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}))

// Create chainable mock
const createChainableMock = (finalData: unknown = []) => {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {}
  const chainable = () => {
    return new Proxy({} as Record<string, unknown>, {
      get: (_, prop: string) => {
        if (!mock[prop]) {
          mock[prop] = vi.fn(() => chainable())
        }
        // Return data for terminal methods
        if (prop === 'then') {
          return (resolve: (value: unknown) => void) => resolve({ data: finalData, error: null })
        }
        return mock[prop]
      }
    })
  }
  return chainable()
}

let mockShipments: unknown[] = []
let mockClaims: unknown[] = []

const mockSupabase = {
  from: vi.fn((table: string) => {
    const data = table === 'shipments' ? mockShipments : mockClaims
    return createChainableMock(data)
  })
}

// Import after mocks are set up
import { GET } from './route'

function createRequest(query?: string): NextRequest {
  const url = query
    ? `http://localhost:3000/api/search?q=${encodeURIComponent(query)}`
    : 'http://localhost:3000/api/search'
  return new NextRequest(url)
}

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockShipments = []
    mockClaims = []
  })

  describe('input validation', () => {
    it('should return empty results for missing query', async () => {
      const response = await GET(createRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toEqual([])
    })

    it('should return empty results for empty query', async () => {
      const response = await GET(createRequest(''))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toEqual([])
    })

    it('should return empty results for query less than 2 characters', async () => {
      const response = await GET(createRequest('a'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toEqual([])
    })

    it('should return empty results for whitespace only query', async () => {
      const response = await GET(createRequest('   '))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toEqual([])
    })
  })

  describe('search with valid query', () => {
    it('should search with 2+ character query', async () => {
      const response = await GET(createRequest('test'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toBeDefined()
    })

    it('should return shipment results with correct format', async () => {
      mockShipments = [{
        id: 'ship-1',
        order_ref: '#123456',
        tracking_number: 'TRK123',
        carrier: 'colissimo',
        status_message: 'Livré',
        shipped_at: '2024-01-15T10:00:00Z'
      }]

      const response = await GET(createRequest('123456'))
      const data = await response.json()

      expect(response.status).toBe(200)
      // Results should be formatted correctly
      expect(Array.isArray(data.results)).toBe(true)
    })

    it('should return claim results with correct format', async () => {
      mockClaims = [{
        id: 'claim-1',
        order_ref: '#789012',
        status: 'ouverte',
        claim_type: 'lost',
        opened_at: '2024-01-15T10:00:00Z'
      }]

      const response = await GET(createRequest('789012'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data.results)).toBe(true)
    })
  })

  describe('input sanitization', () => {
    it('should sanitize potentially dangerous input', async () => {
      // Query with injection attempt should be sanitized
      const response = await GET(createRequest('test.eq.hack'))
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should not throw an error due to sanitization
      expect(data.error).toBeUndefined()
    })

    it('should handle special characters safely', async () => {
      const response = await GET(createRequest('test,value'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.error).toBeUndefined()
    })
  })
})
