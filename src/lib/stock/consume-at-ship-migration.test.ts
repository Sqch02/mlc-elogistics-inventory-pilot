import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/00096_consume_at_ship_gate.sql',
)

describe('00096 consume-at-ship contract', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('defines the SQL predicate as the exact TS vocabulary mirror', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_consumable_shipment')
    expect(sql).toContain('(2000, 2001)')
    expect(sql).toContain("('On Hold','Unfulfilled','Processing','','Cancelled','Cancelled - customer')")
    expect(sql).toContain('LANGUAGE sql IMMUTABLE')
  })

  it('gates the atomic shipment consumer before claiming stock_consumed_at', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.consume_shipment_stock')
    expect(sql).toContain('NOT public.is_consumable_shipment')
    expect(sql.indexOf('NOT public.is_consumable_shipment')).toBeLessThan(
      sql.indexOf('UPDATE public.shipments\n  SET stock_consumed_at = now()'),
    )
  })

  it('reverses a shipment atomically from its movement ledger', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.restock_shipment_stock')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain("sm.movement_type IN ('shipment', 'restock')")
    expect(sql).toContain('PERFORM public.apply_stock_delta')
  })

  it('keeps both remap overloads bounded and behind the shipment predicate', () => {
    expect(sql.match(/CREATE OR REPLACE FUNCTION public\.remap_unmapped_items/g)).toHaveLength(2)
    expect(sql).toContain('LIMIT LEAST(COALESCE(p_limit, 2000), 2000)')
    expect(sql).toContain('public.is_consumable_shipment')
    expect(sql).toContain('public.consume_shipment_stock')
  })

  it('revokes every new or replaced RPC from public users', () => {
    for (const signature of [
      'is_consumable_shipment(integer, text, boolean)',
      'consume_shipment_stock(uuid, uuid)',
      'restock_shipment_stock(uuid, uuid, text)',
      'remap_unmapped_items(uuid)',
      'remap_unmapped_items(uuid, integer)',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated`)
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role`)
    }
  })
})
