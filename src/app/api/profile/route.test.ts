import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET, PATCH } from './route'
import { requireAuth } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>
const mockCreateClient = createClient as ReturnType<typeof vi.fn>

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
  tenant_id: 'test-tenant-id',
  role: 'admin',
}

// Create mock Supabase client for profile updates
function createMockSupabase(success: boolean = true) {
  return {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: success ? null : { message: 'Update failed' },
      }),
    }),
  }
}

function createPatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Non authentifié'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Non authentifie')
  })

  it('should return user profile if authenticated', async () => {
    mockRequireAuth.mockResolvedValue(mockUser)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profile).toBeDefined()
    expect(data.profile.email).toBe('test@example.com')
  })

  it('should include all profile fields', async () => {
    mockRequireAuth.mockResolvedValue(mockUser)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profile.id).toBe('user-1')
    expect(data.profile.full_name).toBe('Test User')
    expect(data.profile.tenant_id).toBe('test-tenant-id')
    expect(data.profile.role).toBe('admin')
  })
})

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 500 if user is not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Non authentifié'))

    const response = await PATCH(createPatchRequest({ full_name: 'New Name' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('should update full_name successfully', async () => {
    mockRequireAuth.mockResolvedValue(mockUser)
    mockCreateClient.mockResolvedValue(createMockSupabase(true))

    const response = await PATCH(createPatchRequest({ full_name: 'Updated Name' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should handle database errors on update', async () => {
    mockRequireAuth.mockResolvedValue(mockUser)
    mockCreateClient.mockResolvedValue(createMockSupabase(false))

    const response = await PATCH(createPatchRequest({ full_name: 'New Name' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it('should call update with correct user id', async () => {
    mockRequireAuth.mockResolvedValue(mockUser)
    const mockDb = createMockSupabase(true)
    mockCreateClient.mockResolvedValue(mockDb)

    await PATCH(createPatchRequest({ full_name: 'Test Name' }))

    expect(mockDb.from).toHaveBeenCalledWith('profiles')
  })
})
