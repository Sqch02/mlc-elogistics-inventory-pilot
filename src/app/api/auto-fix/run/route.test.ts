import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/untyped', () => ({ getAdminDb: vi.fn(() => ({ marker: 'admin' })) }))
vi.mock('@/lib/auto-fix', () => ({ runAutoFixDryRunWorker: vi.fn() }))

import { POST } from './route'
import { getAdminDb } from '@/lib/supabase/untyped'
import { runAutoFixDryRunWorker } from '@/lib/auto-fix'

const originalSecret = process.env.CRON_SECRET

describe('POST /api/auto-fix/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret
  })

  it('does not instantiate service role before CRON_SECRET authorization', async () => {
    const response = await POST(new NextRequest('http://localhost/api/auto-fix/run', { method: 'POST' }))
    expect(response.status).toBe(401)
    expect(getAdminDb).not.toHaveBeenCalled()
    expect(runAutoFixDryRunWorker).not.toHaveBeenCalled()
  })

  it('fails closed when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const response = await POST(new NextRequest('http://localhost/api/auto-fix/run', { method: 'POST' }))
    expect(response.status).toBe(500)
    expect(getAdminDb).not.toHaveBeenCalled()
  })

  it('runs only the dry-run worker after authorization', async () => {
    vi.mocked(runAutoFixDryRunWorker).mockResolvedValue({
      mode: 'simulated', workerId: 'dry-worker', tenants: 0, claimed: 0,
      simulated: 0, failed: 0, stoppedByBudget: false,
      piiRedacted: 0, cleanupFailed: false,
    })
    const response = await POST(new NextRequest('http://localhost/api/auto-fix/run', {
      method: 'POST', headers: { authorization: 'Bearer cron-secret' },
    }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('simulated')
    expect(getAdminDb).toHaveBeenCalledOnce()
    expect(runAutoFixDryRunWorker).toHaveBeenCalledOnce()
  })
})
