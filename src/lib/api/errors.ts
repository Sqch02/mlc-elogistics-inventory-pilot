import { NextResponse } from 'next/server'

export class AuthError extends Error {
  readonly status: 401 | 403

  constructor(message: string, status: 401 | 403) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/**
 * Convert a typed authentication/authorization failure into an API response.
 * Non-auth errors deliberately return null so existing route-specific logging,
 * payloads and 500 handling remain unchanged.
 */
export function handleAuthError(error: unknown): NextResponse | null {
  if (!(error instanceof AuthError)) return null

  return NextResponse.json(
    { error: error.message },
    { status: error.status },
  )
}
