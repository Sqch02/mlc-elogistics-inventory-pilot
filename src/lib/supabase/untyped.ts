/**
 * Shared Supabase client accessors.
 *
 * Kept as a compatibility module while callers migrate to the explicit client
 * factories. Return types intentionally preserve the generated Database schema.
 */

import { createClient as createBrowserClient } from './client'
import { createClient as createServerClient } from './server'
import { createAdminClient } from './admin'

export async function getServerDb(): Promise<Awaited<ReturnType<typeof createServerClient>>> {
  return await createServerClient()
}

export function getAdminDb(): ReturnType<typeof createAdminClient> {
  return createAdminClient()
}

export function getBrowserDb(): ReturnType<typeof createBrowserClient> {
  return createBrowserClient()
}
