import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/auth', () => ({ requireTenant: vi.fn() }))
vi.mock('@/lib/supabase/untyped', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/sendcloud/client', () => ({ cancelParcel: vi.fn(), getParcel: vi.fn() }))
vi.mock('@/lib/stock/consume', () => ({ restockShipmentStock: vi.fn() }))

import { POST } from './route'
import { requireTenant } from '@/lib/supabase/auth'
import { getAdminDb } from '@/lib/supabase/untyped'
import { cancelParcel, getParcel } from '@/lib/sendcloud/client'
import { restockShipmentStock } from '@/lib/stock/consume'

function adminClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'tenant_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { sendcloud_api_key: 'key', sendcloud_secret: 'secret' },
                error: null,
              }),
            })),
          })),
        }
      }
      if (table === 'shipments') {
        const updateChain = {
          eq: vi.fn(function eq() { return updateChain }),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(function eq() {
              return {
                eq,
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'shipment-1', tenant_id: 'tenant-1', sendcloud_id: '123',
                    status_id: 11, status_message: 'Delivered',
                  },
                  error: null,
                }),
              }
            }),
          })),
          update: vi.fn(() => updateChain),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

describe('POST /api/shipments/[id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireTenant).mockResolvedValue('tenant-1')
    vi.mocked(getAdminDb).mockReturnValue(adminClient() as unknown as ReturnType<typeof getAdminDb>)
    vi.mocked(cancelParcel).mockResolvedValue({ success: true })
    vi.mocked(getParcel).mockResolvedValue({ success: false, error: 'not found' })
    vi.mocked(restockShipmentStock).mockResolvedValue({ restocked: true, count: 1 })
  })

  it('restocks atomically after Sendcloud and local cancellation', async () => {
    const response = await POST(
      new NextRequest('https://example.test/api/shipments/shipment-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'shipment-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      stock_restocked: true,
      stock_reconciliation_pending: false,
    })
    expect(restockShipmentStock).toHaveBeenCalledWith('tenant-1', 'shipment-1', 'Annulation UI')
  })

  it('retries the exact cancelled shipment outside the tenant sweeper gate', async () => {
    vi.mocked(restockShipmentStock)
      .mockRejectedValueOnce(new Error('database timeout'))
      .mockResolvedValueOnce({ restocked: true, count: 1 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(
      new NextRequest('https://example.test/api/shipments/shipment-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'shipment-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      stock_restocked: true,
      stock_reconciliation_pending: false,
    })
    expect(restockShipmentStock).toHaveBeenCalledTimes(2)
  })

  it('bounds targeted retries and reports pending when all attempts fail', async () => {
    vi.mocked(restockShipmentStock).mockRejectedValue(new Error('database unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(
      new NextRequest('https://example.test/api/shipments/shipment-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'shipment-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      stock_restocked: false,
      stock_reconciliation_pending: true,
    })
    expect(restockShipmentStock).toHaveBeenCalledTimes(3)
  })
})
