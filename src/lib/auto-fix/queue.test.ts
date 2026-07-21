import { describe, expect, it, vi } from 'vitest'
import type { ParsedShipment } from '@/lib/sendcloud/types'
import { buildOperationKey } from './fingerprint'
import { buildAutoFixCandidate, enqueueAutoFixCandidates } from './queue'
import { buildSimulationPlanFromJob } from './plan'

function parsedShipment(raw: Record<string, unknown>, sendcloudId = '123'): ParsedShipment {
  return {
    sendcloud_id: sendcloudId,
    shipped_at: '2026-07-21T08:00:00.000Z',
    carrier: 'mondial_relay', service: null, weight_grams: 500,
    order_ref: 'PRIVATE-ORDER-42', tracking: null, raw_json: raw as never,
    recipient_name: 'Private Person', recipient_email: 'private@example.com',
    recipient_phone: '+33123456789', recipient_company: null,
    address_line1: 'Secret street 10', address_line2: null, house_number: '10',
    city: 'Paris', postal_code: '75001', country_code: 'FR', country_name: 'France',
    status_id: 1002, status_message: 'Announcement failed', tracking_url: null,
    label_url: null, total_value: 10, currency: 'EUR', service_point_id: null,
    is_return: false, collo_count: 1, length_cm: null, width_cm: null, height_cm: null,
    external_order_id: null, date_created: '2026-07-21T08:00:00.000Z',
    date_updated: '2026-07-21T08:01:00.000Z', date_announced: null,
    has_error: true, error_message: 'Address too long',
  }
}

describe('auto-fix queue model', () => {
  it('keeps simulated and future live operation keys distinct', () => {
    const base = {
      tenantId: 'tenant-1', sourceKind: 'parcel' as const, sourceSendcloudId: '123',
      sourceFingerprint: 'a'.repeat(64), patterns: ['address_too_long'] as const,
    }
    const simulated = buildOperationKey({ ...base, patterns: [...base.patterns], mode: 'simulated' })
    const live = buildOperationKey({ ...base, patterns: [...base.patterns], mode: 'live' })
    expect(simulated).not.toBe(live)
  })

  it('builds a redacted deterministic candidate', () => {
    const source = {
      shipmentId: 'shipment-1',
      shipment: parsedShipment({
        id: 123,
        name: 'Private Person', email: 'private@example.com', address: 'Secret street 10',
        errors: { address: ['Address too long, maximum 30 characters'] },
      }),
    }
    const one = buildAutoFixCandidate('tenant-1', source, { defaultHsCode: null, defaultOriginCountry: null })!
    const two = buildAutoFixCandidate('tenant-1', source, { defaultHsCode: null, defaultOriginCountry: null })!
    const persisted = JSON.stringify({ evidence: one.evidence_json, summary: one.source_summary_json })

    expect(one.operation_key).toBe(two.operation_key)
    expect(persisted).not.toContain('Private Person')
    expect(persisted).not.toContain('private@example.com')
    expect(persisted).not.toContain('Secret street')
    expect(persisted).not.toContain('Address too long')
    expect(one.source_order_ref_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('persists customs default availability, not customs values', () => {
    const candidate = buildAutoFixCandidate('tenant-1', {
      shipmentId: 'shipment-1',
      shipment: parsedShipment({
        id: 123,
        errors: { parcel_items: { 0: { hs_code: ['HS code is required'] } } },
        parcel_items: [{ weight: '0.2' }],
      }),
    }, { defaultHsCode: '123456', defaultOriginCountry: 'FR' })!

    expect(JSON.stringify(candidate.source_summary_json)).not.toContain('123456')
    const plan = buildSimulationPlanFromJob({
      id: 'job-1', tenant_id: 'tenant-1', shipment_id: 'shipment-1',
      source_kind: 'parcel', source_sendcloud_id: '123',
      source_fingerprint: candidate.source_fingerprint,
      primary_pattern: candidate.primary_pattern, detected_patterns: candidate.detected_patterns,
      operation_key: candidate.operation_key, mode: 'simulated',
      evidence_json: candidate.evidence_json, source_summary_json: candidate.source_summary_json,
    })
    expect(plan.wouldEndState).toBe('verified')
    expect(plan.changes[0]).toMatchObject({ hs_source: 'tenant_settings.default_hs_code' })
  })

  it('enqueues one idempotent batch through the service RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null })
    const result = await enqueueAutoFixCandidates({ rpc }, 'tenant-1', [{
      shipmentId: 'shipment-1',
      shipment: parsedShipment({ errors: { sender_eori: ['EORI is required'] } }, 'uuid-1'),
    }], { defaultHsCode: null, defaultOriginCountry: null })

    expect(result).toEqual({ detected: 1, enqueuedOrSeen: 1 })
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc.mock.calls[0][0]).toBe('enqueue_auto_fix_jobs')
  })

  it.each([
    [{ currency: 'CHF' }, ['currency_chf']],
    [{ carrier_code: 'mondial_relay' }, ['service_point_missing']],
  ] as const)('keeps capability-gated patterns pending in simulation', (sourceSummary, patterns) => {
    const plan = buildSimulationPlanFromJob({
      id: 'job-1', tenant_id: 'tenant-1', shipment_id: 'shipment-1',
      source_kind: 'parcel', source_sendcloud_id: '123', source_fingerprint: 'a'.repeat(64),
      primary_pattern: patterns[0], detected_patterns: [...patterns], operation_key: 'b'.repeat(64),
      mode: 'simulated', evidence_json: {}, source_summary_json: sourceSummary,
    })
    expect(plan.wouldEndState).toBe('pending_manual')
    expect(plan.warnings.length).toBeGreaterThan(0)
  })
})
