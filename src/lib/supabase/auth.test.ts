import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./server', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { createClient } from './server'
import { requireAuth, requireRole, requireTenant } from './auth'
import { AuthError } from '@/lib/api/errors'

const mockCreateClient = vi.mocked(createClient)

function createAuthClient(profile: Record<string, unknown> | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: profile ? { id: profile.id } : null },
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: profile ? [profile] : null,
      error: null,
    }),
  }
}

describe('typed auth guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    { guard: requireAuth, label: 'requireAuth' },
    { guard: requireTenant, label: 'requireTenant' },
  ])('$label throws a typed 401 when no authenticated user exists', async ({ guard }) => {
    mockCreateClient.mockResolvedValue(createAuthClient(null) as never)

    await expect(guard()).rejects.toMatchObject({
      name: 'AuthError',
      message: 'Authentication required',
      status: 401,
    } satisfies Partial<AuthError>)
  })

  it('requireRole throws a typed 403 for an authenticated but unauthorized user', async () => {
    mockCreateClient.mockResolvedValue(createAuthClient({
      id: 'user-1',
      email: 'ops@example.test',
      tenant_id: 'tenant-1',
      role: 'ops',
      full_name: 'Ops User',
    }) as never)

    await expect(requireRole(['admin'])).rejects.toMatchObject({
      name: 'AuthError',
      message: 'Insufficient permissions',
      status: 403,
    } satisfies Partial<AuthError>)
  })
})
