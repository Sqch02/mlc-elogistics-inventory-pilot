import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00097_stock_reconcile_and_recalibration.sql'),
  'utf8',
)

describe('00097 stock reconciliation and recalibration contract', () => {
  it('hard-caps the sweeper and uses non-blocking row locks', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.reconcile_tenant_stock')
    expect(sql).toContain('LEAST(200, GREATEST(1, COALESCE(p_limit, 200)))')
    expect(sql.match(/FOR UPDATE SKIP LOCKED/g)?.length).toBeGreaterThanOrEqual(2)
    expect(sql).toContain('public.consume_shipment_stock')
    expect(sql).toContain('public.restock_shipment_stock')
  })

  it('indexes both bounded candidate directions without scanning shipments', () => {
    expect(sql).toContain('idx_shipments_tenant_consumed_recent')
    expect(sql).toContain('WHERE stock_consumed_at IS NOT NULL')
    expect(sql).not.toContain('DROP INDEX')
  })

  it('reports only consumed shipments that are no longer consumable', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.recalibrate_consumed_not_shipped_report')
    expect(sql).toContain('s.stock_consumed_at IS NOT NULL')
    expect(sql).toContain('NOT public.is_consumable_shipment')
    expect(sql).toContain("sm.movement_type = 'shipment'")
  })

  it('guards apply with an expected total and resets only the locked target rows', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.recalibrate_consumed_not_shipped_apply')
    expect(sql).toContain('p_expected_total')
    expect(sql).toContain('recalibration total changed')
    expect(sql).toContain("'Recalibration consume-at-ship'")
    expect(sql).toContain('SET stock_consumed_at = NULL')
  })

  it('keeps all functions service-role only', () => {
    for (const signature of [
      'reconcile_tenant_stock(uuid, integer)',
      'recalibrate_consumed_not_shipped_report(uuid)',
      'recalibrate_consumed_not_shipped_apply(uuid, integer)',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated`)
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role`)
    }
  })
})
