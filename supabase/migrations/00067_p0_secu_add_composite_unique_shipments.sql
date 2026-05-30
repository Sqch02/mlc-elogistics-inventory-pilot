-- Step 1 of POST_MERGE p0-secu plan: add composite UNIQUE (tenant_id, sendcloud_id).
-- ADDITIVE - keeps the existing UNIQUE on sendcloud_id alone so the old code
-- onConflict 'sendcloud_id' would still work during the rollout.
-- The follow-up DROP of the global UNIQUE happens in 00068.

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_tenant_sendcloud_unique
  ON public.shipments (tenant_id, sendcloud_id);

ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_tenant_sendcloud_unique;

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_tenant_sendcloud_unique
  UNIQUE USING INDEX idx_shipments_tenant_sendcloud_unique;
