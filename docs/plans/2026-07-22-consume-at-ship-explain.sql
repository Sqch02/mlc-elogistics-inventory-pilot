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
-- 2. Loop 2 uses idx_shipments_tenant_unconsumed_consumable.
-- 3. Neither plan contains a Seq Scan on public.shipments or a top-N heapsort.
-- 4. Each query returns at most 200 rows.
-- 5. Record execution time and shared/local buffer reads before activation.
-- 6. "Rows Removed by Filter" on the shipments index scan must stay near zero.
--    A large value means the index does not materialize the full predicate and
--    the sweeper is re-scanning the whole cohort every tick (see 7).
--
-- MEASURED IN PRODUCTION, 2026-07-24 (FLORNA, tenant f1073a00-...-000000000001):
--   Loop 1: Index Scan on idx_shipments_tenant_non_consumable_consumed,
--           35 ms, 75 buffers (all cache hits), 0 rows. PASS.
--   Loop 2 with idx_shipments_tenant_unconsumed_shipped_recent only:
--           3293 ms, 6201 buffers, "Rows Removed by Filter: 6063" for 5 real
--           candidates. FAIL -- see 7.
--   Loop 2 after adding idx_shipments_tenant_unconsumed_consumable:
--           16 ms, 67 buffers, 0 rows removed by filter. PASS (203x faster).
--
-- 7. WHY the INCLUDE-only index was not enough (keep this in mind before
--    "optimising" any predicate through INCLUDE columns on this table):
--      a. The sweeper query takes FOR UPDATE, so PostgreSQL needs the heap
--         tuple (ctid) and can never use an Index Only Scan. INCLUDE columns
--         therefore save nothing here.
--      b. public.is_consumable_shipment is declared SET search_path = public.
--         PostgreSQL refuses to inline any SQL function carrying a SET clause,
--         so it is a real per-row function call, not a folded expression.
--         Do NOT drop the SET clause to win inlining: it is the project's
--         SECURITY DEFINER/search_path convention. Materialize the predicate in
--         a partial index instead, exactly like loop 1 does.
