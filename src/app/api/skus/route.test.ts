import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/auth', () => ({
  requireTenant: vi.fn().mockResolvedValue('test-tenant-id'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
}))

vi.mock('@/lib/audit', () => ({
  auditCreate: vi.fn().mockResolvedValue(undefined),
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
function createMockGetClient(skusData: unknown[] = [], bundlesData: unknown[] = []) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'skus') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => void) => resolve({ data: skusData, error: null }),
        }
      }
      if (table === 'bundles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => void) => resolve({ data: bundlesData, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
      }
    }),
  }
}

// Create mock Supabase client for POST operations
function createMockPostClient(options: {
  existingCheck?: unknown
  insertedSku?: unknown
  insertError?: unknown
} = {}) {
  const { existingCheck = null, insertedSku = { id: 'new-sku-id', sku_code: 'TEST-001' }, insertError = null } = options
  let callCount = 0

  return {
    from: vi.fn((table: string) => {
      if (table === 'skus') {
        callCount++
        // First call is for existence check
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: existingCheck, error: null }),
          }
        }
        // Second call is for insert
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: insertedSku, error: insertError }),
        }
      }
      if (table === 'stock_snapshots') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }),
  }
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/skus', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/skus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return SKUs array', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient([
      { id: 'sku-1', sku_code: 'TEST-001', name: 'Test Product', stock_snapshots: [{ qty_current: 100 }] },
      { id: 'sku-2', sku_code: 'TEST-002', name: 'Test Product 2', stock_snapshots: [{ qty_current: 50 }] },
    ]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.skus).toBeDefined()
    expect(Array.isArray(data.skus)).toBe(true)
  })

  it('should return empty array when no SKUs exist', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient([]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.skus).toEqual([])
  })

  it('should filter out bundle SKUs by ID', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient(
      [
        { id: 'sku-1', sku_code: 'TEST-001', name: 'Regular SKU', stock_snapshots: [] },
        { id: 'sku-bundle', sku_code: 'TEST-002', name: 'Bundle SKU', stock_snapshots: [] },
      ],
      [{ bundle_sku_id: 'sku-bundle' }]
    ))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.skus).toHaveLength(1)
    expect(data.skus[0].sku_code).toBe('TEST-001')
  })

  it('should filter out bundle SKUs by code pattern', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient([
      { id: 'sku-1', sku_code: 'TEST-001', name: 'Regular SKU', stock_snapshots: [] },
      { id: 'sku-2', sku_code: 'BU-001', name: 'Bundle SKU', stock_snapshots: [] },
      { id: 'sku-3', sku_code: 'FLRNBU-001', name: 'Florin Bundle', stock_snapshots: [] },
    ]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.skus).toHaveLength(1)
    expect(data.skus[0].sku_code).toBe('TEST-001')
  })

  it('should flatten stock snapshot data', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient([
      {
        id: 'sku-1',
        sku_code: 'TEST-001',
        name: 'Test Product',
        stock_snapshots: [{ qty_current: 100, updated_at: '2024-01-15T10:00:00Z' }],
      },
    ]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.skus[0].qty_current).toBe(100)
    expect(data.skus[0].stock_updated_at).toBe('2024-01-15T10:00:00Z')
  })

  it('should require tenant authentication', async () => {
    mockGetServerDb.mockResolvedValue(createMockGetClient())

    await GET()

    expect(mockRequireTenant).toHaveBeenCalled()
  })
})

describe('POST /api/skus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 if sku_code is missing', async () => {
    mockGetServerDb.mockResolvedValue(createMockPostClient())

    const response = await POST(createPostRequest({ name: 'Test Product' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('sku_code et name sont requis')
  })

  it('should return 400 if name is missing', async () => {
    mockGetServerDb.mockResolvedValue(createMockPostClient())

    const response = await POST(createPostRequest({ sku_code: 'TEST-001' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('sku_code et name sont requis')
  })

  it('should return 409 if SKU already exists', async () => {
    mockGetServerDb.mockResolvedValue(createMockPostClient({
      existingCheck: { id: 'existing-id' },
    }))

    const response = await POST(createPostRequest({
      sku_code: 'TEST-001',
      name: 'Test Product',
    }))
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBe('Ce code SKU existe déjà')
  })

  it('should create a new SKU successfully', async () => {
    mockGetServerDb.mockResolvedValue(createMockPostClient({
      insertedSku: { id: 'new-sku-id', sku_code: 'TEST-001', name: 'Test Product' },
    }))

    const response = await POST(createPostRequest({
      sku_code: 'TEST-001',
      name: 'Test Product',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('SKU créé avec succès')
    expect(data.sku).toBeDefined()
  })

  it('should accept optional weight and alert_threshold', async () => {
    mockGetServerDb.mockResolvedValue(createMockPostClient({
      insertedSku: {
        id: 'new-sku-id',
        sku_code: 'TEST-001',
        name: 'Test Product',
        weight_grams: 500,
        alert_threshold: 20,
      },
    }))

    const response = await POST(createPostRequest({
      sku_code: 'TEST-001',
      name: 'Test Product',
      weight_grams: 500,
      alert_threshold: 20,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should accept initial stock quantity', async () => {
    mockGetServerDb.mockResolvedValue(createMockPostClient({
      insertedSku: { id: 'new-sku-id', sku_code: 'TEST-001', name: 'Test Product' },
    }))

    const response = await POST(createPostRequest({
      sku_code: 'TEST-001',
      name: 'Test Product',
      qty_initial: 100,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
