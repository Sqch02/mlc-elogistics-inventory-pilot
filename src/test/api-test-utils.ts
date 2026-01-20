/**
 * Test utilities for API route testing
 */
import { vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock user for authenticated requests
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  tenant_id: 'test-tenant-id',
  role: 'admin' as const,
}

export const mockTenantId = 'test-tenant-id'

// Create a mock NextRequest
export function createMockRequest(
  url: string,
  options: {
    method?: string
    body?: Record<string, unknown>
    searchParams?: Record<string, string>
  } = {}
): NextRequest {
  const { method = 'GET', body, searchParams } = options

  let fullUrl = `http://localhost:3000${url}`
  if (searchParams) {
    const params = new URLSearchParams(searchParams)
    fullUrl += `?${params.toString()}`
  }

  if (body && method !== 'GET') {
    return new NextRequest(fullUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  return new NextRequest(fullUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Parse JSON response from NextResponse
export async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

// Mock Supabase client
export function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const mockSelect = vi.fn().mockReturnThis()
  const mockInsert = vi.fn().mockReturnThis()
  const mockUpdate = vi.fn().mockReturnThis()
  const mockDelete = vi.fn().mockReturnThis()
  const mockEq = vi.fn().mockReturnThis()
  const mockNeq = vi.fn().mockReturnThis()
  const mockGte = vi.fn().mockReturnThis()
  const mockLte = vi.fn().mockReturnThis()
  const mockIn = vi.fn().mockReturnThis()
  const mockOr = vi.fn().mockReturnThis()
  const mockOrder = vi.fn().mockReturnThis()
  const mockLimit = vi.fn().mockReturnThis()
  const mockRange = vi.fn().mockReturnThis()
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    neq: mockNeq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    or: mockOr,
    order: mockOrder,
    limit: mockLimit,
    range: mockRange,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    ...overrides,
  }))

  return {
    from: mockFrom,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockEq,
    mockSingle,
  }
}

// Setup common mocks for API tests
export function setupApiMocks() {
  // Mock getFastUser
  vi.mock('@/lib/supabase/fast-auth', () => ({
    getFastUser: vi.fn().mockResolvedValue(mockUser),
    getFastTenantId: vi.fn().mockResolvedValue(mockTenantId),
  }))

  // Mock requireTenant
  vi.mock('@/lib/supabase/auth', () => ({
    requireTenant: vi.fn().mockResolvedValue(mockTenantId),
    requireAuth: vi.fn().mockResolvedValue(mockUser),
    requireRole: vi.fn().mockResolvedValue(mockUser),
    getCurrentUser: vi.fn().mockResolvedValue(mockUser),
  }))
}
