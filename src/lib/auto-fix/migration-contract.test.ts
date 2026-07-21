import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00093_auto_fix_dry_run_foundation.sql'),
  'utf8',
)

describe('00093 auto-fix migration contract', () => {
  it('claims and locks jobs atomically with SKIP LOCKED', () => {
    const claim = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.claim_auto_fix_jobs'),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.get_auto_fix_simulated_tenants'),
    )
    expect(claim).toContain('FOR UPDATE OF j SKIP LOCKED')
    expect(claim).toContain("SET state = 'claimed'")
    expect(claim).toContain('RETURNING j.*')
  })

  it('has no cascading foreign key on the append-only audit', () => {
    const auditTable = sql.slice(
      sql.indexOf('CREATE TABLE IF NOT EXISTS public.auto_fixes'),
      sql.indexOf('-- Tables neuves'),
    )
    expect(auditTable).not.toContain('ON DELETE CASCADE')
    expect(auditTable).toContain('ON DELETE RESTRICT')
    expect(auditTable).toContain('ON DELETE SET NULL')
  })

  it('refuses live enqueue and leaves attempt_count untouched in simulation failures', () => {
    expect(sql).toContain("COALESCE(elem->>'mode', '') <> 'simulated'")
    const failure = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.fail_auto_fix_simulation'),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.cleanup_auto_fix_pii'),
    )
    expect(failure).toContain('simulation_failure_count = v_failures')
    expect(failure).not.toContain('attempt_count =')
  })

  it('keeps table mutations behind service-only RPCs', () => {
    expect(sql).not.toContain('GRANT ALL ON TABLE public.auto_fix_jobs')
    expect(sql).toContain('GRANT SELECT ON TABLE public.auto_fix_jobs, public.auto_fixes TO service_role')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.enqueue_auto_fix_jobs(jsonb) TO service_role')
  })

  it('scrubs retained JSON in bounded batches', () => {
    const cleanup = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.cleanup_auto_fix_pii'))
    expect(cleanup).toContain('LIMIT p_limit FOR UPDATE SKIP LOCKED')
    expect(cleanup).toContain('before_json = NULL')
    expect(cleanup).toContain("source_summary_json = '{}'::jsonb")
  })
})
