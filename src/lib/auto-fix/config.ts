export type AutoFixGate =
  | { enabled: true; mode: 'simulated' }
  | { enabled: false; reason: 'global_paused' | 'dry_run_disabled' }

export type AutoFixEnvironment = Readonly<Record<string, string | undefined>>

export function resolveAutoFixGate(env: AutoFixEnvironment = process.env): AutoFixGate {
  // Fail closed: missing/malformed pause flag means paused.
  if (env.AUTO_FIX_PAUSED !== 'false') return { enabled: false, reason: 'global_paused' }
  if (env.AUTO_FIX_DRY_RUN_ENABLED !== 'true') return { enabled: false, reason: 'dry_run_disabled' }
  return { enabled: true, mode: 'simulated' }
}

export function workerBudgetMs(env: AutoFixEnvironment = process.env): number {
  const parsed = Number.parseInt(env.AUTO_FIX_DRY_RUN_BUDGET_MS ?? '20000', 10)
  if (!Number.isFinite(parsed)) return 20_000
  return Math.min(45_000, Math.max(1_000, parsed))
}

export function enqueueBatchCap(env: AutoFixEnvironment = process.env): number {
  const parsed = Number.parseInt(env.AUTO_FIX_DRY_RUN_ENQUEUE_CAP ?? '50', 10)
  if (!Number.isFinite(parsed)) return 50
  return Math.min(100, Math.max(1, parsed))
}
