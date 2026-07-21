import { describe, expect, it, vi } from 'vitest'
import type { ParsedShipment } from '@/lib/sendcloud/types'
import { enqueueDetectedSyncBatch } from './ingest'

function shipment(id: string, raw: Record<string, unknown>): ParsedShipment {
  return {
    sendcloud_id: id, shipped_at: '2026-07-21T08:00:00.000Z', carrier: 'test',
    service: null, weight_grams: 100, order_ref: null, tracking: null, raw_json: raw as never,
    recipient_name: null, recipient_email: null, recipient_phone: null, recipient_company: null,
    address_line1: null, address_line2: null, house_number: null, city: null,
    postal_code: null, country_code: null, country_name: null, status_id: null,
    status_message: null, tracking_url: null, label_url: null, total_value: null,
    currency: 'EUR', service_point_id: null, is_return: false, collo_count: 1,
    length_cm: null, width_cm: null, height_cm: null, external_order_id: null,
    date_created: null, date_updated: null, date_announced: null,
    has_error: false, error_message: null,
  }
}

describe('enqueueDetectedSyncBatch', () => {
  it('only resolves bounded candidates from the current in-memory batch', async () => {
    const input = [
      shipment('1', { status: { id: 1002 } }),
      shipment('2', { errors: { address: ['Address too long, max 30 characters'] } }),
      shipment('3', { errors: { sender_eori: ['EORI is required'] } }),
      shipment('4', { errors: { mystery: ['Unknown carrier problem'] } }),
    ]
    const resolveIds = vi.fn().mockResolvedValue(new Map([
      ['2', 'db-2'], ['3', 'db-3'],
    ]))
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null })

    const result = await enqueueDetectedSyncBatch(
      { rpc }, 'tenant-1', input,
      { defaultHsCode: null, defaultOriginCountry: null },
      resolveIds, 2,
    )

    expect(resolveIds).toHaveBeenCalledWith(['2', '3'])
    expect(result).toEqual({
      observed: 4, eligible: 3, resolved: 2, detected: 2,
      enqueuedOrSeen: 2, truncated: true,
    })
    expect(rpc).toHaveBeenCalledOnce()
  })

  it('does no database work when no structured cause exists', async () => {
    const resolveIds = vi.fn()
    const rpc = vi.fn()
    const result = await enqueueDetectedSyncBatch(
      { rpc }, 'tenant-1', [shipment('1', { warnings: ['On Hold'] })],
      { defaultHsCode: null, defaultOriginCountry: null }, resolveIds, 50,
    )

    expect(result.detected).toBe(0)
    expect(resolveIds).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
