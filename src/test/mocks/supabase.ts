import { vi } from 'vitest'

/**
 * Creates a mock Supabase client for unit testing
 */
export function createMockSupabaseClient() {
  const mockSelect = vi.fn().mockReturnThis()
  const mockInsert = vi.fn().mockReturnThis()
  const mockUpdate = vi.fn().mockReturnThis()
  const mockDelete = vi.fn().mockReturnThis()
  const mockUpsert = vi.fn().mockReturnThis()
  const mockEq = vi.fn().mockReturnThis()
  const mockNeq = vi.fn().mockReturnThis()
  const mockGte = vi.fn().mockReturnThis()
  const mockLte = vi.fn().mockReturnThis()
  const mockGt = vi.fn().mockReturnThis()
  const mockLt = vi.fn().mockReturnThis()
  const mockIn = vi.fn().mockReturnThis()
  const mockIs = vi.fn().mockReturnThis()
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
    upsert: mockUpsert,
    eq: mockEq,
    neq: mockNeq,
    gte: mockGte,
    lte: mockLte,
    gt: mockGt,
    lt: mockLt,
    in: mockIn,
    is: mockIs,
    order: mockOrder,
    limit: mockLimit,
    range: mockRange,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  }))

  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })

  return {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    // Expose mocks for assertions
    _mocks: {
      from: mockFrom,
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      upsert: mockUpsert,
      eq: mockEq,
      neq: mockNeq,
      gte: mockGte,
      lte: mockLte,
      gt: mockGt,
      lt: mockLt,
      in: mockIn,
      is: mockIs,
      order: mockOrder,
      limit: mockLimit,
      range: mockRange,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      rpc: mockRpc,
    },
  }
}

/**
 * Mock for requireTenant auth function
 */
export const mockRequireTenant = vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000001')

/**
 * Mock for requireAuth function
 */
export const mockRequireAuth = vi.fn().mockResolvedValue({
  id: 'test-user-id',
  email: 'test@example.com',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  role: 'admin',
})
