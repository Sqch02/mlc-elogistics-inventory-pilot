import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00097_stock_reconcile_and_recalibration.sql'),
  'utf8',
)

describe('00097 stock reconciliation and recalibration contract', () => {
  it('hard-caps the sweeper and gates historical reversal per tenant', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.reconcile_tenant_stock')
    expect(sql).toContain('LEAST(200, GREATEST(1, COALESCE(p_limit, 200)))')
    expect(sql.match(/FOR UPDATE SKIP LOCKED/g)?.length).toBeGreaterThanOrEqual(2)
    expect(sql).toContain('consume_at_ship_enabled boolean NOT NULL DEFAULT false')
    expect(sql).toContain('IF v_historical_reversal_enabled THEN')
    expect(sql).toContain('public.consume_shipment_stock')
    expect(sql).toContain('public.restock_shipment_stock')
  })

  it('uses a concurrent predicate-matched partial index for historical reversal', () => {
    expect(sql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS')
    expect(sql).toContain('idx_shipments_tenant_non_consumable_consumed')
    expect(sql).toContain('NOT public.is_consumable_shipment(status_id, status_message, is_return)')
    expect(sql).toContain('INCLUDE (status_id, status_message, is_return)')
    expect(sql).not.toContain('DROP INDEX')
  })

  it('reports requested and effective floor-clamped restoration separately', () => {
    const movements = [
      { adjustment: -5, qtyBefore: 2, qtyAfter: 0 },
      { adjustment: -1, qtyBefore: 4, qtyAfter: 3 },
    ]
    const requested = -movements.reduce((sum, row) => sum + row.adjustment, 0)
    const effective = movements.reduce(
      (sum, row) => sum + row.qtyBefore - row.qtyAfter,
      0,
    )

    expect(requested).toBe(6)
    expect(effective).toBe(3)
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.recalibrate_consumed_not_shipped_report')
    expect(sql).toContain('s.stock_consumed_at IS NOT NULL')
    expect(sql).toContain('NOT public.is_consumable_shipment')
    expect(sql).toContain('requested_units_to_restore')
    expect(sql).toContain('effective_units_to_restore')
    expect(sql).toContain('SUM(sm.qty_before - sm.qty_after)')
  })

  it('recalibrates through the shipment reversal ledger, never a manual credit', () => {
    // Consume 5 against stock 2, restore the real 2, then consume/restore 1.
    // The shipment ledger is neutral after both cycles, so a later cancellation
    // cannot manufacture the three units suppressed by the original floor.
    const realEffects = [2, -2, 1, -1]
    expect(realEffects.reduce((sum, effect) => sum + effect, 0)).toBe(0)

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.recalibrate_consumed_not_shipped_apply')
    expect(sql).toContain('p_expected_total')
    expect(sql).toContain('recalibration total changed')
    expect(sql).toContain("'Recalibration consume-at-ship'")
    expect(sql).toContain('public.restock_shipment_stock(')
    expect(sql).not.toContain("NULL::uuid,\n      'recalibration'")
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
