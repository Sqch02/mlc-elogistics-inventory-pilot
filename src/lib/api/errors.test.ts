import { describe, expect, it } from 'vitest'
import { AuthError, handleAuthError } from './errors'

describe('handleAuthError', () => {
  it.each([
    { status: 401 as const, message: 'Authentication required' },
    { status: 403 as const, message: 'Insufficient permissions' },
  ])('returns a $status response for AuthError', async ({ status, message }) => {
    const response = handleAuthError(new AuthError(message, status))

    expect(response).not.toBeNull()
    expect(response?.status).toBe(status)
    await expect(response?.json()).resolves.toEqual({ error: message })
  })

  it('leaves non-auth failures to the route-specific error handler', () => {
    expect(handleAuthError(new Error('Database unavailable'))).toBeNull()
    expect(handleAuthError('unexpected failure')).toBeNull()
  })
})
