-- ============================================================================
-- DO NOT APPLY UNTIL THE p0-secu PR IS MERGED TO main AND DEPLOYED TO RENDER.
-- ============================================================================
--
-- Reason: this migration drops the global UNIQUE on shipments.sendcloud_id and
-- replaces it with a composite UNIQUE (tenant_id, sendcloud_id). The webhook /
-- cron / run routes in this PR are updated to use the new onConflict target.
-- Applying this BEFORE the code is deployed will break those routes:
-- their existing `onConflict: 'sendcloud_id'` would fail with
--   "ON CONFLICT clause does not match any unique or exclusion constraint"
-- and every subsequent webhook/cron call would error out.
--
-- After Render reports the new deploy as healthy, paste this entire block in
-- the Supabase SQL editor (or run via MCP).
--
-- Rollback if needed (UNSAFE if any cross-tenant duplicates have appeared):
--   ALTER TABLE public.shipments
--     DROP CONSTRAINT IF EXISTS shipments_tenant_sendcloud_unique;
--   CREATE UNIQUE INDEX CONCURRENTLY idx_shipments_sendcloud_id
--     ON public.shipments (sendcloud_id);

BEGIN;

-- Step 1: Add the new composite unique constraint (uses a unique index under
-- the hood). CONCURRENTLY not allowed inside a transaction, so we do it the
-- standard way — 110k rows is fast enough (<5s).
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_tenant_sendcloud_unique
  ON public.shipments (tenant_id, sendcloud_id);

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_tenant_sendcloud_unique
  UNIQUE USING INDEX idx_shipments_tenant_sendcloud_unique;

-- Step 2: Drop the old global unique. Safe AFTER step 1 because no code uses it
-- anymore.
DROP INDEX IF EXISTS public.idx_shipments_sendcloud_id;

COMMIT;
