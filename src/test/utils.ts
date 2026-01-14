import { vi } from 'vitest'

/**
 * Create a mock NextRequest for API route testing
 */
export function createMockRequest(
  method: string = 'GET',
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>
) {
  const url = new URL('http://localhost:3000/api/test')

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    method,
    url: url.toString(),
    nextUrl: url,
    json: vi.fn().mockResolvedValue(body || {}),
    text: vi.fn().mockResolvedValue(JSON.stringify(body || {})),
    headers: new Map([
      ['content-type', 'application/json'],
    ]),
  }
}

/**
 * Create a mock Supabase response
 */
export function createMockSupabaseResponse<T>(data: T | null, error: Error | null = null) {
  return {
    data,
    error,
    count: Array.isArray(data) ? data.length : null,
  }
}

/**
 * Wait for all promises to resolve (useful for async state updates)
 */
export async function waitForPromises() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Generate a UUID for testing
 */
export function generateTestUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Default tenant ID for tests
 */
export const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001'
