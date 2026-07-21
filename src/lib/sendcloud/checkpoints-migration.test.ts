import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/00095_sendcloud_sync_checkpoints.sql'),
  'utf8',
)

describe('00095 Sendcloud checkpoint migration contract', () => {
  it('keys checkpoint state by tenant, resource and optional integration', () => {
    expect(sql).toContain('PRIMARY KEY (tenant_id, resource, partition_key)')
    expect(sql).toContain("resource IN ('parcels', 'returns', 'integration_shipments')")
    expect(sql).toContain("resource = 'integration_shipments'")
  })

  it('requires a cursor for partial incremental drains', () => {
    expect(sql).toContain('has_more AND cursor IS NOT NULL AND window_ends_at IS NOT NULL')
    expect(sql).toContain('NOT has_more AND cursor IS NULL AND window_ends_at IS NULL')
  })

  it('keeps the internal checkpoint table service-role only', () => {
    expect(sql).toContain('ALTER TABLE public.sendcloud_sync_checkpoints FORCE ROW LEVEL SECURITY')
    expect(sql).toContain(
      'REVOKE ALL ON TABLE public.sendcloud_sync_checkpoints FROM PUBLIC, anon, authenticated',
    )
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.sendcloud_sync_checkpoints TO service_role',
    )
  })
})
