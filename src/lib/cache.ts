import { NextResponse } from 'next/server'

/**
 * Cache durations for different types of data
 */
export const CACHE_DURATIONS = {
  /** Data that rarely changes (carriers, locations, pricing rules) */
  STATIC: 600, // 10 minutes
  /** Data that changes occasionally (SKUs, bundles, products) */
  SEMI_STATIC: 120, // 2 minutes
  /** Data that changes frequently (shipments, dashboard) */
  DYNAMIC: 60, // 1 minute
  /** Real-time data (stock levels, today's stats) */
  REALTIME: 10, // 10 seconds
  /** No cache */
  NONE: 0,
} as const

/**
 * Apply cache headers to a NextResponse
 * Uses private cache (user-specific data) with stale-while-revalidate
 */
export function withCache<T>(
  data: T,
  maxAge: number = CACHE_DURATIONS.DYNAMIC,
  status: number = 200
): NextResponse<T> {
  const response = NextResponse.json(data, { status })

  if (maxAge > 0) {
    // private = user-specific, no CDN caching
    // stale-while-revalidate = serve stale content while revalidating
    response.headers.set(
      'Cache-Control',
      `private, max-age=${maxAge}, stale-while-revalidate=${maxAge * 5}`
    )
  } else {
    response.headers.set('Cache-Control', 'no-store')
  }

  return response
}

/**
 * Create a cached JSON response for static data
 */
export function cachedResponse<T>(data: T, maxAge: number = CACHE_DURATIONS.DYNAMIC): NextResponse<T> {
  return withCache(data, maxAge)
}

/**
 * Create an error response (never cached)
 */
export function errorResponse(
  error: string | Error,
  status: number = 500
): NextResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : error
  const response = NextResponse.json({ error: message }, { status })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
