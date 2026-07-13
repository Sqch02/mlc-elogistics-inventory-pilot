import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { generateSignature } from '@/lib/utils/webhook-signature'

const { mockGetAdminDb } = vi.hoisted(() => ({
  mockGetAdminDb: vi.fn(),
}))

vi.mock('@/lib/supabase/untyped', () => ({
  getAdminDb: mockGetAdminDb,
}))

import { POST } from './route'

function createAdminClient(settings: {
  sendcloud_webhook_secret: string | null
  sendcloud_secret: string | null
}) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => table === 'tenants'
            ? {
                data: {
                  id: 'tenant-1',
                  name: 'Tenant One',
                  code: 'TENANT',
                  is_active: true,
                },
                error: null,
              }
            : { data: settings, error: null }),
        })),
      })),
    })),
  }
}

function webhookRequest(payload: string, secret: string) {
  return new NextRequest('https://example.test/api/webhooks/sendcloud/TENANT', {
    method: 'POST',
    body: payload,
    headers: {
      'content-type': 'application/json',
      'Sendcloud-Signature': generateSignature(payload, secret),
    },
  })
}

const context = { params: Promise.resolve({ tenantCode: 'TENANT' }) }

describe('POST /api/webhooks/sendcloud/[tenantCode]', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('binds validation to the dedicated tenant secret when configured', async () => {
    mockGetAdminDb.mockReturnValue(createAdminClient({
      sendcloud_webhook_secret: 'dedicated-secret',
      sendcloud_secret: 'integration-secret',
    }))
    const payload = JSON.stringify({ action: 'integration_updated' })

    const wrongSecretResponse = await POST(
      webhookRequest(payload, 'integration-secret'),
      context,
    )
    const validResponse = await POST(
      webhookRequest(payload, 'dedicated-secret'),
      context,
    )

    expect(wrongSecretResponse.status).toBe(401)
    expect(validResponse.status).toBe(200)
  })

  it('keeps the global fallback for a tenant with no configured secrets', async () => {
    vi.stubEnv('SENDCLOUD_WEBHOOK_SECRET', 'global-secret')
    mockGetAdminDb.mockReturnValue(createAdminClient({
      sendcloud_webhook_secret: null,
      sendcloud_secret: null,
    }))
    const payload = JSON.stringify({ action: 'integration_updated' })

    const response = await POST(webhookRequest(payload, 'global-secret'), context)

    expect(response.status).toBe(200)
  })

  it('rejects a signed stale payload after reading the request body once', async () => {
    mockGetAdminDb.mockReturnValue(createAdminClient({
      sendcloud_webhook_secret: 'dedicated-secret',
      sendcloud_secret: null,
    }))
    const payload = JSON.stringify({
      action: 'integration_updated',
      timestamp: Math.floor(Date.now() / 1000) - 301,
    })

    const response = await POST(webhookRequest(payload, 'dedicated-secret'), context)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Stale payload' })
  })
})
