-- OUT-OF-BAND OPERATION — never pass this file to `supabase db push`.
-- Execute each statement standalone (autocommit), after migrations 00096/00097,
-- outside peak hours. CREATE INDEX CONCURRENTLY cannot run in a transaction.
-- Safe to retry because both indexes use IF NOT EXISTS. If an interrupted run
-- leaves an invalid index, inspect pg_index.indisvalid and remove that exact
-- invalid index before retrying.

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

RESET lock_timeout;
