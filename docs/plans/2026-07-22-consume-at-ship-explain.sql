-- NON-MUTATING, but briefly takes row locks because it measures the exact
-- FOR UPDATE SKIP LOCKED query. Run after 00096/00097 are installed, outside
-- the cron window, before enabling consume_at_ship_enabled for FLORNA.
-- FLORNA tenant id comes from the existing project migration plan.

BEGIN;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '500ms';

EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT s.id
FROM public.shipments s
WHERE s.tenant_id = 'f1073a00-0000-4000-a000-000000000001'::uuid
  AND s.stock_consumed_at IS NOT NULL
  AND NOT public.is_consumable_shipment(
    s.status_id,
    s.status_message,
    s.is_return
  )
ORDER BY s.stock_consumed_at DESC, s.id
LIMIT 200
FOR UPDATE SKIP LOCKED;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT s.id
FROM public.shipments s
WHERE s.tenant_id = 'f1073a00-0000-4000-a000-000000000001'::uuid
  AND s.stock_consumed_at IS NULL
  AND public.is_consumable_shipment(
    s.status_id,
    s.status_message,
    s.is_return
  )
  AND EXISTS (
    SELECT 1
    FROM public.shipment_items si
    WHERE si.tenant_id = 'f1073a00-0000-4000-a000-000000000001'::uuid
      AND si.shipment_id = s.id
  )
ORDER BY s.shipped_at DESC NULLS LAST, s.id
LIMIT 200
FOR UPDATE SKIP LOCKED;

ROLLBACK;

-- Acceptance checklist (archive the returned plan with the rollout evidence):
-- 1. Loop 1 uses idx_shipments_tenant_non_consumable_consumed.
-- 2. Loop 2 uses idx_shipments_tenant_unconsumed_shipped_recent.
-- 3. Neither plan contains a Seq Scan on public.shipments or a top-N heapsort.
-- 4. Each query returns at most 200 rows.
-- 5. Record execution time and shared/local buffer reads before activation.
