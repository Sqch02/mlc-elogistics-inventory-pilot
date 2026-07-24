import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CANCELLED_STATUS_IDS,
  NON_CONSUMABLE_STATUS_MESSAGES,
} from './consumable-status'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/00096_consume_at_ship_gate.sql',
)

describe('00096 consume-at-ship contract', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('defines the SQL predicate as the exact TS vocabulary mirror', () => {
    const sqlIds = CANCELLED_STATUS_IDS.join(', ')
    const sqlMessages = NON_CONSUMABLE_STATUS_MESSAGES
      .map((message) => `'${message.replaceAll("'", "''")}'`)
      .join(',')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_consumable_shipment')
    expect(sql).toContain(`(${sqlIds})`)
    expect(sql).toContain(`(${sqlMessages})`)
    expect(sql).toContain('LANGUAGE sql IMMUTABLE')
  })

  it('backfills legacy ledger rows and defensively refuses an outstanding consumption', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.consume_shipment_stock')
    expect(sql).toContain('UPDATE public.shipments AS s')
    expect(sql).toContain("sm.movement_type = 'shipment'")
    expect(sql).toContain("sm.movement_type = 'restock'")
    expect(sql).toContain('sm.reference_id = s.id')
    expect(sql).toContain('NOT public.is_consumable_shipment')
    expect(sql).toContain('NOT EXISTS (')
    expect(sql).toContain('SUM(sm.qty_before - sm.qty_after) > 0')
    expect(sql.indexOf('NOT public.is_consumable_shipment')).toBeLessThan(
      sql.indexOf('UPDATE public.shipments\n  SET stock_consumed_at = now()'),
    )
  })

  it('restores only the real floor-clamped ledger effect', () => {
    const floorClampedMovement = { adjustment: -5, qtyBefore: 2, qtyAfter: 0 }
    const requestedRestore = -floorClampedMovement.adjustment
    const effectiveRestore = floorClampedMovement.qtyBefore - floorClampedMovement.qtyAfter

    expect(requestedRestore).toBe(5)
    expect(effectiveRestore).toBe(2)
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.restock_shipment_stock')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain("sm.movement_type IN ('shipment', 'restock')")
    expect(sql).toContain('SUM(sm.qty_before - sm.qty_after)')
    expect(sql).not.toContain('GREATEST(0, -SUM(sm.adjustment))')
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
