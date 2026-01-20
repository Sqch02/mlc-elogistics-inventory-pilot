import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/fast-auth', () => ({
  getFastTenantId: vi.fn(),
}))

vi.mock('@/lib/supabase/untyped', () => ({
  getServerDb: vi.fn(),
}))

import { GET, POST } from './route'
import { getFastTenantId } from '@/lib/supabase/fast-auth'
import { getServerDb } from '@/lib/supabase/untyped'

const mockGetFastTenantId = getFastTenantId as ReturnType<typeof vi.fn>
const mockGetServerDb = getServerDb as ReturnType<typeof vi.fn>

// Create mock Supabase client for GET operations
function createMockGetClient(locationsData: unknown[] = []) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => void) => resolve({ data: locationsData, error: null }),
    }),
  }
}

// Create mock Supabase client for POST operations
function createMockPostClient(locationData: unknown = { id: 'new-loc-id', code: 'A-01-01' }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: locationData, error: null }),
    }),
  }
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/locations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if not authenticated', async () => {
    mockGetFastTenantId.mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Non authentifié')
  })

  it('should return locations array when authenticated', async () => {
    mockGetFastTenantId.mockResolvedValue('test-tenant-id')
    mockGetServerDb.mockResolvedValue(createMockGetClient([
      { id: 'loc-1', code: 'A-01-01', label: 'Zone A', active: true, assignment: [] },
      { id: 'loc-2', code: 'A-01-02', label: 'Zone A', active: true, assignment: [] },
    ]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.locations).toBeDefined()
    expect(Array.isArray(data.locations)).toBe(true)
  })

  it('should return empty array when no locations exist', async () => {
    mockGetFastTenantId.mockResolvedValue('test-tenant-id')
    mockGetServerDb.mockResolvedValue(createMockGetClient([]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.locations).toEqual([])
  })

  it('should flatten assignment to single object', async () => {
    mockGetFastTenantId.mockResolvedValue('test-tenant-id')
    mockGetServerDb.mockResolvedValue(createMockGetClient([
      {
        id: 'loc-1',
        code: 'A-01-01',
        assignment: [{ sku: { sku_code: 'SKU-001', name: 'Test Product' } }],
      },
    ]))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.locations[0].assignment).toEqual({
      sku: { sku_code: 'SKU-001', name: 'Test Product' },
    })
  })

  it('should handle database errors', async () => {
    mockGetFastTenantId.mockResolvedValue('test-tenant-id')
    mockGetServerDb.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve({ data: null, error: { message: 'DB error' } }),
      }),
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('should include cache headers in response', async () => {
    mockGetFastTenantId.mockResolvedValue('test-tenant-id')
    mockGetServerDb.mockResolvedValue(createMockGetClient([]))

    const response = await GET()

    expect(response.headers.get('Cache-Control')).toBe('private, max-age=60, stale-while-revalidate=300')
  })
})

describe('POST /api/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if not authenticated', async () => {
    mockGetFastTenantId.mockResolvedValue(null)

    const response = await POST(createPostRequest({ code: 'A-01-01' }))
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Non authentifié')
  })

  it('should create a new location', async () => {
    const newLocation = {
      id: 'new-loc-id',
      code: 'B-02-03',
      label: 'Zone B',
      active: true,
    }
    mockGetFastTenantId.mockResolvedValue('test-tenant-id')
    mockGetServerDb.mockResolvedValue(createMockPostClient(newLocation))

    const response = await POST(createPostRequest({
      code: 'B-02-03',
      label: 'Zone B',
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.location).toBeDefined()
  })

  it('should handle database errors on insert', async () => {
    mockGetFastTenantId.mockResolvedValue('test-tenant-id')
    mockGetServerDb.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      }),
    })

    const response = await POST(createPostRequest({ code: 'A-01-01' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('should accept optional label field', async () => {
    mockGetFastTenantId.mockResolvedValue('test-tenant-id')
    mockGetServerDb.mockResolvedValue(createMockPostClient({ id: 'loc-id', code: 'A-01' }))

    const response = await POST(createPostRequest({
      code: 'A-01',
      // no label
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
