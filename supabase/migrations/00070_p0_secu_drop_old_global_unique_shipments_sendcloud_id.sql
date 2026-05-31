-- Step 2 (final) of POST_MERGE p0-secu: drop the legacy global UNIQUE on
-- shipments.sendcloud_id now that the composite (tenant_id, sendcloud_id) is
-- live (00067) and the deployed code targets it via onConflict
-- 'tenant_id,sendcloud_id'.
-- Verified by sync_runs entries with status='success' after the code switchover.
--
-- After this, cross-tenant collisions on sendcloud_id no longer throw - each
-- tenant has its own namespace.

DROP INDEX IF EXISTS public.idx_shipments_sendcloud_id;
