import { describe, expect, it, vi } from 'vitest'
import { runAutoFixDryRunWorker } from './worker'

const enabledEnv = {
  AUTO_FIX_PAUSED: 'false',
  AUTO_FIX_DRY_RUN_ENABLED: 'true',
  AUTO_FIX_DRY_RUN_BUDGET_MS: '20000',
}

function claimedJob() {
  return {
    id: 'job-1', tenant_id: 'tenant-1', shipment_id: 'shipment-1',
    source_kind: 'parcel', source_sendcloud_id: '123', source_fingerprint: 'a'.repeat(64),
    primary_pattern: 'address_too_long', detected_patterns: ['address_too_long'],
    operation_key: 'b'.repeat(64), mode: 'simulated', evidence_json: {},
    source_summary_json: { address_lengths: { address: 40 }, address_limits: [{ field: 'address', max: 30 }] },
  }
}

function claimedChfJob(id: string) {
  return {
    ...claimedJob(),
    id,
    source_sendcloud_id: id,
    primary_pattern: 'currency_chf',
    detected_patterns: ['currency_chf'],
    operation_key: id.padEnd(64, 'b').slice(0, 64),
    source_summary_json: {
      currency: 'CHF',
      monetary: {
        total_order_value: '10.00',
        parcel_items: [{ index: 0, quantity: 1, value: '4.00' }, { index: 1, quantity: 1, value: '6.00' }],
      },
    },
  }
}

const chfRate = {
  ok: true as const,
  rate: {
    baseCurrency: 'CHF' as const, targetCurrency: 'EUR' as const, rate: '1.080030240847',
    rateDate: '2026-07-21', provider: 'ECB' as const, providerSeries: 'EXR.D.CHF.EUR.SP00.A' as const,
    providerQuote: { baseCurrency: 'EUR' as const, targetCurrency: 'CHF' as const, rate: '0.9259' },
    fetchedAt: '2026-07-22T08:00:00.000Z', expiresAt: '2026-07-23T08:00:00.000Z', cacheStatus: 'hit' as const,
  },
}

describe('runAutoFixDryRunWorker', () => {
  it('stops before touching the database while globally paused', async () => {
    const rpc = vi.fn()
    const result = await runAutoFixDryRunWorker({ rpc }, {})
    expect(result).toEqual({ paused: true, reason: 'global_paused' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('claims, plans and completes a simulation sequentially', async () => {
    const rpc = vi.fn(async (name: string, _args?: Record<string, unknown>) => {
      void _args
      if (name === 'get_auto_fix_simulated_tenants') {
        return { data: [{ tenant_id: 'tenant-1', max_candidates: 5 }], error: null }
      }
      if (name === 'claim_auto_fix_jobs') return { data: [claimedJob()], error: null }
      if (name === 'plan_auto_fix_simulation') return { data: true, error: null }
      if (name === 'complete_auto_fix_simulation') return { data: true, error: null }
      if (name === 'cleanup_auto_fix_pii') return { data: 0, error: null }
      return { data: null, error: { message: `unexpected ${name}` } }
    })

    const result = await runAutoFixDryRunWorker({ rpc }, enabledEnv)
    expect(result).toMatchObject({ mode: 'simulated', tenants: 1, claimed: 1, simulated: 1, failed: 0 })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'get_auto_fix_simulated_tenants',
      'claim_auto_fix_jobs',
      'plan_auto_fix_simulation',
      'complete_auto_fix_simulation',
      'cleanup_auto_fix_pii',
    ])
    const planArgs = rpc.mock.calls[2][1] as Record<string, unknown>
    expect(planArgs.p_plan).toMatchObject({
      action: 'put_update',
      safeguards: expect.arrayContaining(['no_sendcloud_write', 'no_stock_write', 'no_attempt_consumed', 'no_alert']),
    })
  })

  it('uses the simulation failure path without a live attempt counter', async () => {
    const rpc = vi.fn(async (name: string, _args?: Record<string, unknown>) => {
      void _args
      if (name === 'get_auto_fix_simulated_tenants') {
        return { data: [{ tenant_id: 'tenant-1', max_candidates: 1 }], error: null }
      }
      if (name === 'claim_auto_fix_jobs') return { data: [claimedJob()], error: null }
      if (name === 'plan_auto_fix_simulation') return { data: false, error: null }
      if (name === 'fail_auto_fix_simulation') return { data: 'retry_wait', error: null }
      if (name === 'cleanup_auto_fix_pii') return { data: 0, error: null }
      return { data: null, error: { message: `unexpected ${name}` } }
    })

    const result = await runAutoFixDryRunWorker({ rpc }, enabledEnv)
    expect(result).toMatchObject({ claimed: 1, simulated: 0, failed: 1 })
    expect(rpc.mock.calls.map(([name]) => name)).toContain('fail_auto_fix_simulation')
    const failureCall = rpc.mock.calls.find(([name]) => name === 'fail_auto_fix_simulation')
    const failureArgs = failureCall?.[1] as Record<string, unknown>
    expect(failureArgs).not.toHaveProperty('attempt_count')
  })

  it('resolves one persisted rate for all CHF jobs in the worker run', async () => {
    const rpc = vi.fn(async (name: string, _args?: Record<string, unknown>) => {
      void _args
      if (name === 'get_auto_fix_simulated_tenants') {
        return { data: [{ tenant_id: 'tenant-1', max_candidates: 5 }], error: null }
      }
      if (name === 'claim_auto_fix_jobs') return { data: [claimedChfJob('chf-1'), claimedChfJob('chf-2')], error: null }
      if (name === 'plan_auto_fix_simulation') return { data: true, error: null }
      if (name === 'complete_auto_fix_simulation') return { data: true, error: null }
      if (name === 'cleanup_auto_fix_pii') return { data: 0, error: null }
      return { data: null, error: { message: `unexpected ${name}` } }
    })
    const resolveChfRate = vi.fn(async () => chfRate)

    const result = await runAutoFixDryRunWorker({ rpc }, enabledEnv, { resolveChfRate })

    expect(result).toMatchObject({ claimed: 2, simulated: 2, failed: 0 })
    expect(resolveChfRate).toHaveBeenCalledOnce()
    const plans = rpc.mock.calls
      .filter(([name]) => name === 'plan_auto_fix_simulation')
      .map(([, args]) => (args as Record<string, unknown>).p_plan)
    expect(plans).toHaveLength(2)
    expect(plans).toEqual(expect.arrayContaining([
      expect.objectContaining({ wouldEndState: 'verified', warnings: [] }),
    ]))
    expect(JSON.stringify(plans)).toContain('2026-07-21')
    expect(JSON.stringify(plans)).toContain('10.80')
  })

  it('audits CHF as pending manual when the daily rate is unavailable', async () => {
    const rpc = vi.fn(async (name: string, _args?: Record<string, unknown>) => {
      void _args
      if (name === 'get_auto_fix_simulated_tenants') return { data: [{ tenant_id: 'tenant-1', max_candidates: 1 }], error: null }
      if (name === 'claim_auto_fix_jobs') return { data: [claimedChfJob('chf-1')], error: null }
      if (name === 'plan_auto_fix_simulation') return { data: true, error: null }
      if (name === 'complete_auto_fix_simulation') return { data: true, error: null }
      if (name === 'cleanup_auto_fix_pii') return { data: 0, error: null }
      return { data: null, error: { message: `unexpected ${name}` } }
    })

    const result = await runAutoFixDryRunWorker({ rpc }, enabledEnv, {
      resolveChfRate: async () => ({ ok: false, reason: 'provider_unavailable' }),
    })

    expect(result).toMatchObject({ simulated: 1, failed: 0 })
    const planCall = rpc.mock.calls.find(([name]) => name === 'plan_auto_fix_simulation')
    expect(planCall?.[1]?.p_plan).toMatchObject({
      action: 'manual_required',
      wouldEndState: 'pending_manual',
      warnings: ['Taux BCE CHF/EUR indisponible ou non rafraichissable'],
    })
  })
})
