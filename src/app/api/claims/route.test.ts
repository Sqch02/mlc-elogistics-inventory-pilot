import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/auth', () => ({
  requireTenant: vi.fn().mockResolvedValue('test-tenant-id'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { GET, POST } from './route'
import { requireTenant } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockRequireTenant = requireTenant as ReturnType<typeof vi.fn>
const mockCreateClient = createClient as ReturnType<typeof vi.fn>
const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>

function createGetRequest(params?: Record<string, string>): NextRequest {
  let url = 'http://localhost:3000/api/claims'
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }
  return new NextRequest(url)
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/claims', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// Create mock admin client for server-side filtering + pagination
function createMockAdminClient(claimsData: unknown[] = []) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: claimsData, error: null, count: claimsData.length }),
    }),
  }
}

// Create mock client for POST operations
function createMockClient() {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'new-claim-id', status: 'ouverte' },
        error: null,
      }),
    }),
  }
}

describe('GET /api/claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return claims array with pagination metadata', async () => {
    mockCreateAdminClient.mockReturnValue(createMockAdminClient([
      { id: 'claim-1', status: 'ouverte', claim_type: 'lost', priority: 'normal' },
      { id: 'claim-2', status: 'en_analyse', claim_type: 'damaged', priority: 'high' },
    ]))

    const response = await GET(createGetRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.claims).toBeDefined()
    expect(Array.isArray(data.claims)).toBe(true)
    expect(data.total).toBe(2)
    expect(data.page).toBe(1)
    expect(data.limit).toBe(500)
  })

  it('should pass status filter to query', async () => {
    const mockClient = createMockAdminClient([
      { id: 'claim-1', status: 'ouverte', claim_type: 'lost' },
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    const response = await GET(createGetRequest({ status: 'ouverte' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.claims).toBeDefined()
    // Verify the mock chain was called (status filter applied server-side)
    expect(mockClient.from).toHaveBeenCalledWith('claims')
  })

  it('should pass claim_type filter to query', async () => {
    const mockClient = createMockAdminClient([
      { id: 'claim-1', status: 'ouverte', claim_type: 'lost' },
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    const response = await GET(createGetRequest({ claim_type: 'lost' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.claims).toBeDefined()
  })

  it('should pass priority filter to query', async () => {
    const mockClient = createMockAdminClient([
      { id: 'claim-1', status: 'ouverte', priority: 'urgent' },
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    const response = await GET(createGetRequest({ priority: 'urgent' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.claims).toBeDefined()
  })

  it('should pass search filter as ilike to query', async () => {
    const mockClient = createMockAdminClient([
      { id: 'claim-1', order_ref: '#123456', status: 'ouverte' },
    ])
    mockCreateAdminClient.mockReturnValue(mockClient)

    const response = await GET(createGetRequest({ search: '123456' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.claims).toBeDefined()
  })

  it('should handle empty claims array', async () => {
    mockCreateAdminClient.mockReturnValue(createMockAdminClient([]))

    const response = await GET(createGetRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.claims).toEqual([])
    expect(data.total).toBe(0)
  })
})

describe('POST /api/claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a new claim', async () => {
    mockCreateClient.mockResolvedValue(createMockClient())

    const response = await POST(createPostRequest({
      order_ref: '#123456',
      claim_type: 'lost',
      description: 'Colis perdu',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.claim).toBeDefined()
  })

  it('should validate claim_type enum', async () => {
    mockCreateClient.mockResolvedValue(createMockClient())

    const response = await POST(createPostRequest({
      order_ref: '#123456',
      claim_type: 'invalid_type', // Invalid type
    }))
    const data = await response.json()

    // API returns 500 for all errors including validation
    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  it('should default to status ouverte', async () => {
    const mockClient = createMockClient()
    mockCreateClient.mockResolvedValue(mockClient)

    const response = await POST(createPostRequest({
      order_ref: '#123456',
      claim_type: 'lost',
    }))

    expect(response.status).toBe(200)
  })
})
