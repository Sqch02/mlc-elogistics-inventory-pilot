/**
 * Untyped Supabase client wrapper for API routes
 * Use this when TypeScript inference causes issues with Supabase queries
 */

import { createClient as createBrowserClient } from './client'
import { createClient as createServerClient } from './server'
import { createAdminClient } from './admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getServerDb(): Promise<any> {
  return await createServerClient()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAdminDb(): any {
  return createAdminClient()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBrowserDb(): any {
  return createBrowserClient()
}
