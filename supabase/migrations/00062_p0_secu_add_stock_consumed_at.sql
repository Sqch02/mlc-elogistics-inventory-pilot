-- P0 Security: Add stock_consumed_at marker column.
-- Used by the webhook to know if a shipment already consumed stock (so a later
-- parcel_cancelled can reverse it), and by the cron to detect shipments where
-- consumption failed mid-way (rerun safety).
--
-- Backfill: shipments with shipped_at IS NOT NULL AND is_return = false are
-- assumed to have had their stock consumed (matches historical behavior).
-- Run the backfill in chunks (week-by-week) on a fresh DB to avoid timeouts.

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS stock_consumed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shipments_stock_consumed_at_null
  ON public.shipments (tenant_id, shipped_at)
  WHERE stock_consumed_at IS NULL;

-- Backfill (idempotent — safe to re-run; only updates NULL rows)
UPDATE public.shipments
SET stock_consumed_at = COALESCE(shipped_at, created_at, now())
WHERE stock_consumed_at IS NULL
  AND shipped_at IS NOT NULL
  AND is_return = false;
