import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00094_exchange_rates_cache.sql'),
  'utf8',
)

describe('00094 exchange rate cache contract', () => {
  it('uses exact numerics, a dated rate and a 24 hour refresh lease', () => {
    expect(sql).toContain('rate numeric(20, 12)')
    expect(sql).toContain('rate_date date')
    expect(sql).toContain("now() + interval '24 hours'")
    expect(sql).toContain('ON CONFLICT (base_currency, target_currency) DO UPDATE')
    expect(sql).toContain('refresh_not_before <= now()')
  })

  it('is inaccessible to public users and writable only by service role', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('FORCE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON TABLE public.exchange_rates_cache FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.exchange_rates_cache TO service_role')
    expect(sql).not.toContain('TO authenticated')
  })

  it('keeps the atomic refresh claim service-role only', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_exchange_rate_refresh')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.claim_exchange_rate_refresh(text, text)')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_exchange_rate_refresh(text, text)')
  })
})
