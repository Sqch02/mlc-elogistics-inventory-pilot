-- Migration 00045: Materialized view for SKU consumption metrics
--
-- Replaces the `calculateSKUMetrics` helper (stock.ts) which runs 4 queries + bundle
-- decomposition logic in JS on every dashboard + products page load.
--
-- This mat view pre-computes everything: consumption 30/90d (from decomposed
-- physical units, reuses v_physical_shipment_items), pending restock, days remaining.
-- Refreshed every 5 min by the cron.

DROP MATERIALIZED VIEW IF EXISTS mv_sku_metrics CASCADE;

CREATE MATERIALIZED VIEW mv_sku_metrics AS
WITH consumption AS (
  SELECT
    vp.tenant_id,
    vp.sku_id,
    COALESCE(SUM(vp.physical_qty) FILTER (
      WHERE vp.shipped_at >= NOW() - INTERVAL '30 days'
    ), 0)::bigint AS qty_30d,
    COALESCE(SUM(vp.physical_qty), 0)::bigint AS qty_90d
  FROM v_physical_shipment_items vp
  WHERE vp.is_return = false
    AND vp.shipped_at >= NOW() - INTERVAL '90 days'
  GROUP BY vp.tenant_id, vp.sku_id
),
restock AS (
  SELECT
    tenant_id,
    sku_id,
    COALESCE(SUM(qty), 0)::int AS pending_qty
  FROM inbound_restock
  WHERE received = false
    AND eta_date >= CURRENT_DATE
  GROUP BY tenant_id, sku_id
),
bundle_flag AS (
  SELECT DISTINCT bundle_sku_id, tenant_id FROM bundles
)
SELECT
  s.id AS sku_id,
  s.tenant_id,
  s.sku_code,
  s.name,
  s.alert_threshold,
  COALESCE(ss.qty_current, 0) AS qty_current,
  COALESCE(c.qty_30d, 0) AS consumption_30d,
  COALESCE(c.qty_90d, 0) AS consumption_90d,
  ROUND(COALESCE(c.qty_90d, 0)::numeric / 90, 2) AS avg_daily_90d,
  CASE
    WHEN COALESCE(c.qty_90d, 0) > 0
    THEN FLOOR(COALESCE(ss.qty_current, 0)::numeric / (c.qty_90d::numeric / 90))::int
    ELSE NULL
  END AS days_remaining,
  COALESCE(r.pending_qty, 0) AS pending_restock,
  COALESCE(ss.qty_current, 0) + COALESCE(r.pending_qty, 0) AS projected_stock,
  (bf.bundle_sku_id IS NOT NULL) AS is_bundle
FROM skus s
LEFT JOIN stock_snapshots ss ON ss.sku_id = s.id
LEFT JOIN consumption c ON c.sku_id = s.id AND c.tenant_id = s.tenant_id
LEFT JOIN restock r ON r.sku_id = s.id AND r.tenant_id = s.tenant_id
LEFT JOIN bundle_flag bf ON bf.bundle_sku_id = s.id AND bf.tenant_id = s.tenant_id
WHERE s.active = true;

CREATE UNIQUE INDEX idx_mv_sku_metrics_pk ON mv_sku_metrics(sku_id);
CREATE INDEX idx_mv_sku_metrics_tenant ON mv_sku_metrics(tenant_id);
CREATE INDEX idx_mv_sku_metrics_tenant_days_left ON mv_sku_metrics(tenant_id, days_remaining)
  WHERE is_bundle = false;

CREATE OR REPLACE FUNCTION refresh_sku_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sku_metrics;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_sku_metrics TO service_role;
GRANT SELECT ON mv_sku_metrics TO service_role, authenticated;

-- Single consolidated refresh function called by cron at end of sync.
-- Refreshes the 3 views in the correct order (sku_metrics depends on physical_items).
CREATE OR REPLACE FUNCTION refresh_all_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_physical_shipment_items;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sku_metrics;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_all_analytics_views TO service_role;

REFRESH MATERIALIZED VIEW mv_sku_metrics;
