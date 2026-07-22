import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { generateSignature } from '@/lib/utils/webhook-signature'
import type { SendcloudParcel } from '@/lib/sendcloud/types'

const { mockGetAdminDb } = vi.hoisted(() => ({
  mockGetAdminDb: vi.fn(),
}))

vi.mock('@/lib/supabase/untyped', () => ({
  getAdminDb: mockGetAdminDb,
}))

vi.mock('@/lib/stock/consume', () => ({
  consumeShipmentStockOnce: vi.fn(),
  restockShipmentStock: vi.fn(),
}))
vi.mock('@/lib/utils/sku-mapping', () => ({
  processShipmentItems: vi.fn(),
}))

import { POST } from './route'
import { consumeShipmentStockOnce, restockShipmentStock } from '@/lib/stock/consume'
import { processShipmentItems } from '@/lib/utils/sku-mapping'

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

function parcelAdminClient(stockConsumedAt: string | null = '2026-07-22T10:00:00.000Z') {
  const existingShipment = { id: 'shipment-1', stock_consumed_at: stockConsumedAt }
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn((table: string) => {
      if (table === 'tenants') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'tenant-1', name: 'Tenant One', code: 'TENANT', is_active: true },
            error: null,
          }),
        })) })) }
      }
      if (table === 'tenant_settings') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { sendcloud_webhook_secret: 'dedicated-secret', sendcloud_secret: null },
            error: null,
          }),
        })) })) }
      }
      if (table === 'pricing_rules') {
        const chain = {
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => chain) })) }
      }
      if (table === 'shipments') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(function eq() {
            return { eq, single: vi.fn().mockResolvedValue({ data: existingShipment, error: null }) }
          }) })),
          upsert: vi.fn(() => ({ select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'shipment-1' }, error: null }),
          })) })),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

function parcel(statusId: number, statusMessage: string, withItems = false): SendcloudParcel {
  return {
    id: 123,
    tracking_number: 'TRACK-1',
    carrier: { code: 'test' },
    name: 'Test',
    address: '1 rue Test',
    city: 'Paris',
    postal_code: '75001',
    country: { iso_2: 'FR' },
    weight: '1.000',
    order_number: 'ORDER-1',
    shipment: { id: 1, name: 'Test' },
    status: { id: statusId, message: statusMessage },
    created_at: '2026-07-22T10:00:00.000Z',
    date_created: null,
    date_updated: null,
    date_announced: null,
    updated_at: '2026-07-22T10:00:00.000Z',
    parcel_items: withItems ? [{
      description: 'Test item', sku: 'SKU-1', quantity: 1, weight: '1.000', value: '10.00',
    }] : undefined,
  }
}

const context = { params: Promise.resolve({ tenantCode: 'TENANT' }) }

describe('POST /api/webhooks/sendcloud/[tenantCode]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('reverses stock when parcel_status_changed moves to numeric cancellation', async () => {
    mockGetAdminDb.mockReturnValue(parcelAdminClient())
    vi.mocked(restockShipmentStock).mockResolvedValue({ restocked: true, count: 1 })
    const payload = JSON.stringify({
      action: 'parcel_status_changed',
      parcel: parcel(2001, 'Refused'),
    })

    const response = await POST(webhookRequest(payload, 'dedicated-secret'), context)

    expect(response.status).toBe(200)
    expect(restockShipmentStock).toHaveBeenCalledWith(
      'tenant-1',
      'shipment-1',
      'Annulation/refus Sendcloud',
    )
  })

  it('waits on On Hold then consumes the same existing row on Fulfilled transition', async () => {
    mockGetAdminDb.mockReturnValue(parcelAdminClient(null))
    vi.mocked(processShipmentItems).mockResolvedValue({ mappedCount: 1, unmappedCount: 0 })
    vi.mocked(consumeShipmentStockOnce).mockResolvedValue({ consumed: true, count: 1 })

    const onHoldPayload = JSON.stringify({
      action: 'parcel_status_changed', parcel: parcel(0, 'On Hold', true),
    })
    const fulfilledPayload = JSON.stringify({
      action: 'parcel_status_changed', parcel: parcel(0, 'Fulfilled', true),
    })

    await POST(webhookRequest(onHoldPayload, 'dedicated-secret'), context)
    expect(consumeShipmentStockOnce).not.toHaveBeenCalled()

    await POST(webhookRequest(fulfilledPayload, 'dedicated-secret'), context)
    expect(consumeShipmentStockOnce).toHaveBeenCalledOnce()
    expect(consumeShipmentStockOnce).toHaveBeenCalledWith('tenant-1', 'shipment-1')
  })
})
