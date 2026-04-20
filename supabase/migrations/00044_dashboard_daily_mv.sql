-- Migration 00044: Materialized view for dashboard daily aggregates
--
-- Replaces 9 parallel queries on the dashboard with 1-2 reads from a pre-aggregated
-- daily table. Refreshed every 5 min by the cron (same cadence as v_physical_shipment_items).
--
-- The mat view is per (tenant, day). Everything the KPI cards need for the current month
-- can be read by filtering tenant_id + day range.

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_daily CASCADE;

CREATE MATERIALIZED VIEW mv_dashboard_daily AS
SELECT
  tenant_id,
  DATE(shipped_at) AS day,
  COUNT(*) FILTER (WHERE is_return = false)::bigint AS shipments_count,
  COUNT(*) FILTER (WHERE is_return = false AND pricing_status = 'ok')::bigint AS shipments_priced,
  COUNT(*) FILTER (WHERE is_return = false AND pricing_status = 'missing')::bigint AS shipments_missing_pricing,
  COALESCE(SUM(computed_cost_eur) FILTER (WHERE is_return = false AND pricing_status = 'ok'), 0)::numeric(14,2) AS shipments_cost
FROM shipments
WHERE shipped_at IS NOT NULL
GROUP BY tenant_id, DATE(shipped_at);

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_dashboard_daily_pk ON mv_dashboard_daily(tenant_id, day);
CREATE INDEX idx_mv_dashboard_daily_recent ON mv_dashboard_daily(tenant_id, day DESC);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_dashboard_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_daily;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_dashboard_daily TO service_role;
GRANT SELECT ON mv_dashboard_daily TO service_role, authenticated;

-- Convenience RPC: single call returns everything the dashboard page needs
-- for a given month + yesterday, plus all-time missing pricing total.
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_tenant_id UUID,
  p_month_start DATE,
  p_month_end DATE,
  p_yesterday DATE
)
RETURNS TABLE (
  metric TEXT,
  day DATE,
  shipments_count BIGINT,
  shipments_cost NUMERIC,
  shipments_missing_pricing BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Monthly totals row (metric = 'month')
  SELECT
    'month'::text AS metric,
    NULL::date AS day,
    COALESCE(SUM(shipments_count), 0)::bigint,
    COALESCE(SUM(shipments_cost), 0)::numeric,
    COALESCE(SUM(shipments_missing_pricing), 0)::bigint
  FROM mv_dashboard_daily
  WHERE tenant_id = p_tenant_id
    AND day >= p_month_start
    AND day <= p_month_end

  UNION ALL

  -- All-time missing pricing (metric = 'all_time_missing')
  SELECT
    'all_time_missing'::text,
    NULL::date,
    0::bigint,
    0::numeric,
    COALESCE(SUM(shipments_missing_pricing), 0)::bigint
  FROM mv_dashboard_daily
  WHERE tenant_id = p_tenant_id

  UNION ALL

  -- Yesterday row (metric = 'yesterday')
  SELECT
    'yesterday'::text,
    p_yesterday,
    COALESCE(shipments_count, 0)::bigint,
    COALESCE(shipments_cost, 0)::numeric,
    COALESCE(shipments_missing_pricing, 0)::bigint
  FROM mv_dashboard_daily
  WHERE tenant_id = p_tenant_id AND day = p_yesterday

  UNION ALL

  -- Daily rows for chart (metric = 'day')
  SELECT
    'day'::text,
    day,
    shipments_count,
    shipments_cost,
    shipments_missing_pricing
  FROM mv_dashboard_daily
  WHERE tenant_id = p_tenant_id
    AND day >= p_month_start
    AND day <= p_month_end
  ORDER BY metric, day;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO service_role, authenticated;

-- Initial population
REFRESH MATERIALIZED VIEW mv_dashboard_daily;
