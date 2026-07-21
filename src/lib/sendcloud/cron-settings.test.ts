import { describe, expect, it, vi } from 'vitest'
import {
  AUTO_FIX_MODE_COLUMN,
  CRON_TENANT_SETTINGS_COLUMNS,
  loadCronTenantSettings,
  loadTenantAutoFixMode,
} from './cron-settings'

describe('cron tenant settings isolation', () => {
  it('keeps the Phase 2 column out of the vital settings projection', () => {
    expect(CRON_TENANT_SETTINGS_COLUMNS).not.toContain(AUTO_FIX_MODE_COLUMN)
  })

  it('propagates a critical settings query error', async () => {
    await expect(loadCronTenantSettings(async () => ({
      data: null,
      error: { message: 'database unavailable' },
    }))).rejects.toThrow('tenant_settings query failed: database unavailable')
  })

  it('distinguishes a missing settings row from a query failure', async () => {
    await expect(loadCronTenantSettings(async () => ({ data: null, error: null })))
      .resolves.toBeNull()
  })

  it('never evaluates the auto-fix column query while the gate is closed', async () => {
    const query = vi.fn()
    await expect(loadTenantAutoFixMode(false, query)).resolves.toEqual({
      mode: 'off', queried: false, error: null,
    })
    expect(query).not.toHaveBeenCalled()
  })

  it('fails auto-fix closed without interrupting sync when the optional column lookup fails', async () => {
    await expect(loadTenantAutoFixMode(true, async () => ({
      data: null,
      error: { message: 'column auto_fix_mode does not exist' },
    }))).resolves.toEqual({
      mode: 'off', queried: true, error: 'column auto_fix_mode does not exist',
    })
  })

  it('returns a valid enabled tenant mode', async () => {
    await expect(loadTenantAutoFixMode(true, async () => ({
      data: { auto_fix_mode: 'simulated' as const },
      error: null,
    }))).resolves.toEqual({ mode: 'simulated', queried: true, error: null })
  })
})
