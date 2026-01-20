import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/auth', () => ({
  requireTenant: vi.fn().mockResolvedValue('test-tenant-id'),
}))

vi.mock('@/lib/supabase/untyped', () => ({
  getServerDb: vi.fn(),
}))

import { GET, POST } from './route'
import { requireTenant } from '@/lib/supabase/auth'
import { getServerDb } from '@/lib/supabase/untyped'

const mockRequireTenant = requireTenant as ReturnType<typeof vi.fn>
const mockGetServerDb = getServerDb as ReturnType<typeof vi.fn>

// Create mock Supabase client for GET operations
function createMockGetClient(rulesData: unknown[] = []) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => void) => resolve({ data: rulesData, error: null }),
    }),
  }
}

// Create mock Supabase client for POST operations
function createMockPostClient(ruleData: unknown = { id: 'new-rule-id' }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ruleData, error: null }),
    }),
  }
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/pricing', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return pricing rules array', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient([
      { id: 'rule-1', carrier: 'colissimo', weight_min_grams: 0, weight_max_grams: 500, price_eur: 5.50 },
      { id: 'rule-2', carrier: 'colissimo', weight_min_grams: 500, weight_max_grams: 1000, price_eur: 7.50 },
    ]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.rules).toBeDefined()
    expect(Array.isArray(data.rules)).toBe(true)
    expect(data.rules).toHaveLength(2)
  })

  it('should return empty array when no rules exist', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient([]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.rules).toEqual([])
  })

  it('should require tenant authentication', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient([]))

    await GET()

    expect(mockRequireTenant).toHaveBeenCalled()
  })

  it('should handle database errors', async () => {
    mockGetServerDb.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve({ data: null, error: { message: 'Database error' } }),
      }),
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })
})

describe('POST /api/pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a new pricing rule', async () => {
    const newRule = {
      id: 'new-rule-id',
      carrier: 'chronopost',
      weight_min_grams: 0,
      weight_max_grams: 500,
      price_eur: 8.00,
    }
    mockGetServerDb.mockResolvedValue(createMockPostClient(newRule))

    const response = await POST(createPostRequest({
      carrier: 'chronopost',
      weight_min_grams: 0,
      weight_max_grams: 500,
      price_eur: 8.00,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.rule).toBeDefined()
  })

  it('should require tenant authentication', async () => {
    mockGetServerDb.mockResolvedValue(createMockPostClient())

    await POST(createPostRequest({
      carrier: 'chronopost',
      weight_min_grams: 0,
      weight_max_grams: 500,
      price_eur: 8.00,
    }))

    expect(mockRequireTenant).toHaveBeenCalled()
  })

  it('should handle database errors on insert', async () => {
    mockGetServerDb.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      }),
    })

    const response = await POST(createPostRequest({
      carrier: 'chronopost',
      weight_min_grams: 0,
      weight_max_grams: 500,
      price_eur: 8.00,
    }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('should accept optional destination field', async () => {
    const ruleWithDest = {
      id: 'rule-with-dest',
      carrier: 'colissimo',
      destination: 'FR',
      weight_min_grams: 0,
      weight_max_grams: 1000,
      price_eur: 6.00,
    }
    mockGetServerDb.mockResolvedValue(createMockPostClient(ruleWithDest))

    const response = await POST(createPostRequest({
      carrier: 'colissimo',
      destination: 'FR',
      weight_min_grams: 0,
      weight_max_grams: 1000,
      price_eur: 6.00,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
