import { describe, expect, it } from 'vitest'
import { enqueueBatchCap, resolveAutoFixGate, workerBudgetMs } from './config'

describe('auto-fix gates', () => {
  it('fails closed when the global pause flag is absent or malformed', () => {
    expect(resolveAutoFixGate({})).toEqual({ enabled: false, reason: 'global_paused' })
    expect(resolveAutoFixGate({ AUTO_FIX_PAUSED: 'FALSE', AUTO_FIX_DRY_RUN_ENABLED: 'true' }))
      .toEqual({ enabled: false, reason: 'global_paused' })
  })

  it('requires the independent dry-run gate after the global gate', () => {
    expect(resolveAutoFixGate({ AUTO_FIX_PAUSED: 'false' }))
      .toEqual({ enabled: false, reason: 'dry_run_disabled' })
    expect(resolveAutoFixGate({ AUTO_FIX_PAUSED: 'false', AUTO_FIX_DRY_RUN_ENABLED: 'true' }))
      .toEqual({ enabled: true, mode: 'simulated' })
  })

  it('bounds time and enqueue budgets', () => {
    expect(workerBudgetMs({ AUTO_FIX_DRY_RUN_BUDGET_MS: '999999' })).toBe(45_000)
    expect(workerBudgetMs({ AUTO_FIX_DRY_RUN_BUDGET_MS: '1' })).toBe(1_000)
    expect(enqueueBatchCap({ AUTO_FIX_DRY_RUN_ENQUEUE_CAP: '999' })).toBe(100)
    expect(enqueueBatchCap({ AUTO_FIX_DRY_RUN_ENQUEUE_CAP: '0' })).toBe(1)
  })
})
