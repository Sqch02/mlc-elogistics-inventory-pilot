export interface CronTenantSettings {
  sendcloud_api_key: string | null
  sendcloud_secret: string | null
  default_hs_code: string | null
  default_origin_country: string | null
}

export type TenantAutoFixMode = 'off' | 'simulated' | 'live'

export const CRON_TENANT_SETTINGS_COLUMNS =
  'sendcloud_api_key, sendcloud_secret, default_hs_code, default_origin_country' as const
export const AUTO_FIX_MODE_COLUMN = 'auto_fix_mode' as const

interface QueryError {
  message: string
}

interface QueryResult<T> {
  data: T | null
  error: QueryError | null
}

type SettingsQuery<T> = () => PromiseLike<QueryResult<T>>

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Credentials are part of the vital sync path: database errors must propagate
 * so the caller records a failed sync instead of pretending credentials are absent.
 */
export async function loadCronTenantSettings(
  query: SettingsQuery<CronTenantSettings>,
): Promise<CronTenantSettings | null> {
  let result: QueryResult<CronTenantSettings>
  try {
    result = await query()
  } catch (error) {
    throw new Error(`tenant_settings query failed: ${errorMessage(error)}`)
  }
  if (result.error) {
    throw new Error(`tenant_settings query failed: ${result.error.message}`)
  }
  return result.data
}

/**
 * auto_fix_mode is optional to the sync. The query itself is not evaluated
 * while the global gate is closed, and every lookup failure fails closed to off.
 */
export async function loadTenantAutoFixMode(
  gateEnabled: boolean,
  query: SettingsQuery<{ auto_fix_mode: TenantAutoFixMode }>,
): Promise<{ mode: TenantAutoFixMode; queried: boolean; error: string | null }> {
  if (!gateEnabled) return { mode: 'off', queried: false, error: null }

  let result: QueryResult<{ auto_fix_mode: TenantAutoFixMode }>
  try {
    result = await query()
  } catch (error) {
    return { mode: 'off', queried: true, error: errorMessage(error) }
  }
  if (result.error) {
    return { mode: 'off', queried: true, error: result.error.message }
  }
  const mode = result.data?.auto_fix_mode
  if (mode !== 'off' && mode !== 'simulated' && mode !== 'live') {
    return { mode: 'off', queried: true, error: 'auto_fix_mode absent ou invalide' }
  }
  return { mode, queried: true, error: null }
}
