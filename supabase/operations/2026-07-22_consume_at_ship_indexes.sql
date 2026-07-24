-- OUT-OF-BAND OPERATION — never pass this file to `supabase db push`.
-- Execute each statement standalone (autocommit), after migrations 00096/00097,
-- outside peak hours. CREATE INDEX CONCURRENTLY cannot run in a transaction.
-- Safe to retry because every index uses IF NOT EXISTS. If an interrupted run
-- leaves an invalid index, inspect pg_index.indisvalid and remove that exact
-- invalid index before retrying.
--
-- ============================================================================
-- READ THIS BEFORE TOUCHING public.is_consumable_shipment
-- ============================================================================
-- The partial indexes below carry a call to is_consumable_shipment in their
-- WHERE predicate, so their contents are frozen against the function body that
-- existed when they were built. PostgreSQL trusts the IMMUTABLE declaration:
-- a CREATE OR REPLACE of that function does NOT rebuild them, and raises no
-- error and no warning. The indexes silently keep classifying shipments with
-- the OLD rule.
--
-- Why that is dangerous here rather than merely stale: consume_shipment_stock
-- re-checks the predicate under FOR UPDATE, so sweeper direction 2 protects
-- itself. restock_shipment_stock does NOT re-check anything — direction 1
-- delegates the entire decision to the index contents. A stale index there
-- gives stock back for parcels that genuinely shipped, inflating stock.
--
-- So any change to the vocabulary — that is, to NON_CONSUMABLE_STATUS_MESSAGES
-- or CANCELLED_STATUS_IDS in src/lib/stock/consumable-status.ts and its SQL
-- mirror — MUST be followed, in the same maintenance window, by:
--   REINDEX INDEX CONCURRENTLY public.idx_shipments_tenant_non_consumable_consumed;
--   REINDEX INDEX CONCURRENTLY public.idx_shipments_tenant_unconsumed_consumable;
-- ============================================================================

SET lock_timeout = '2s';

-- Sweeper direction 1: consumed rows that became non-consumable.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_tenant_non_consumable_consumed
  ON public.shipments (tenant_id, stock_consumed_at DESC, id)
  INCLUDE (status_id, status_message, is_return)
  WHERE stock_consumed_at IS NOT NULL
    AND NOT public.is_consumable_shipment(status_id, status_message, is_return);

-- Sweeper direction 2: recent unconsumed candidates. NULLS LAST exactly matches
-- the query so PostgreSQL does not add a top-N heapsort. Included status fields
-- let it reject non-consumable rows without fetching every candidate heap tuple.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_tenant_unconsumed_shipped_recent
  ON public.shipments (tenant_id, shipped_at DESC NULLS LAST, id)
  INCLUDE (status_id, status_message, is_return)
  WHERE stock_consumed_at IS NULL;

-- Sweeper direction 2 (measured fix, 2026-07-24). The index above still costs a
-- full scan of the unconsumed cohort every tick: `INCLUDE` cannot serve the
-- predicate because `FOR UPDATE` forces heap access, and
-- `is_consumable_shipment` is declared `SET search_path = public`, which makes
-- it non-inlinable, so PostgreSQL calls it once per candidate row.
--
-- Measured on FLORNA in production before this index: 6068 rows scanned to
-- return 5 candidates, 3293 ms, 6201 buffers -- every 5 minutes, on the exact
-- cron path that saturated disk I/O on 13/07. The unconsumed cohort only grows,
-- because non-consumable shipments keep stock_consumed_at NULL forever.
--
-- Materializing the full predicate (same pattern as direction 1) makes the scan
-- proportional to real candidates instead of the whole cohort.
-- After this index: 16 ms, 67 buffers, 0 rows removed by filter (203x faster).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_tenant_unconsumed_consumable
  ON public.shipments (tenant_id, shipped_at DESC NULLS LAST, id)
  WHERE stock_consumed_at IS NULL
    AND public.is_consumable_shipment(status_id, status_message, is_return);

RESET lock_timeout;

-- FOLLOW-UP: once idx_shipments_tenant_unconsumed_consumable is confirmed to
-- serve every sweeper direction-2 plan, idx_shipments_tenant_unconsumed_shipped_recent
-- becomes redundant and only adds write amplification on the sync hot path.
-- Check `pg_stat_user_indexes.idx_scan` stays flat for a few days, then:
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_shipments_tenant_unconsumed_shipped_recent;
