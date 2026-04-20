-- Migration 00047: Materialized view for Shopify anomalies detection
--
-- The previous RPC did a CROSS JOIN LATERAL over raw_json on every page load,
-- which forced us to cap the window to 7 days to avoid timeouts. By pre-computing
-- the anomaly rows in a mat view refreshed by the cron, we can extend the window
-- to the start of the year and return instantly.
--
-- The CTE pre-filters to anomaly rows only, so the mat view stays small
-- (hundreds, not hundreds of thousands of rows).

DROP MATERIALIZED VIEW IF EXISTS mv_shopify_anomaly_items CASCADE;

CREATE MATERIALIZED VIEW mv_shopify_anomaly_items AS
WITH raw_items AS (
  SELECT
    s.id AS shipment_id,
    s.tenant_id,
    s.order_ref,
    s.shipped_at,
    s.recipient_name,
    item->>'sku' AS raw_sku,
    item->>'description' AS raw_description,
    COALESCE((item->>'quantity')::int, 1) AS qty
  FROM shipments s
  CROSS JOIN LATERAL jsonb_array_elements(s.raw_json->'parcel_items') AS a(item)
  WHERE s.is_return = false
    AND s.shipped_at >= DATE_TRUNC('year', CURRENT_DATE)
    AND s.raw_json ? 'parcel_items'
    AND (
      s.status_message IS NULL
      OR s.status_message NOT IN ('Cancelled', 'Cancelled - customer', 'On Hold', 'Unfulfilled')
    )
)
SELECT
  shipment_id,
  tenant_id,
  order_ref,
  shipped_at,
  recipient_name,
  raw_sku,
  raw_description,
  qty,
  (CASE
    WHEN raw_description ~ '^#[0-9]+$' THEN 'order_ref_as_description'
    WHEN (raw_sku IS NULL OR raw_sku = '')
         AND raw_description IS NOT NULL AND raw_description <> '' THEN 'empty_sku'
    WHEN raw_sku ~ ' ' THEN 'sku_with_spaces'
    WHEN raw_sku ~ '[éèêàùçôâîïüÉÈÊÀÙÇÔÂÎÏÜ]' THEN 'sku_with_accents'
  END)::text AS anomaly_type
FROM raw_items
WHERE
  raw_description ~ '^#[0-9]+$'
  OR ((raw_sku IS NULL OR raw_sku = '') AND raw_description IS NOT NULL AND raw_description <> '')
  OR raw_sku ~ ' '
  OR raw_sku ~ '[éèêàùçôâîïüÉÈÊÀÙÇÔÂÎÏÜ]';

-- Unique key for REFRESH CONCURRENTLY (shipment + raw content combo is unique enough)
CREATE UNIQUE INDEX idx_mv_shopify_anomaly_items_pk
  ON mv_shopify_anomaly_items(
    shipment_id,
    COALESCE(raw_sku, ''),
    COALESCE(raw_description, '')
  );
CREATE INDEX idx_mv_shopify_anomaly_items_tenant_type
  ON mv_shopify_anomaly_items(tenant_id, anomaly_type);

GRANT SELECT ON mv_shopify_anomaly_items TO service_role, authenticated;

CREATE OR REPLACE FUNCTION refresh_shopify_anomaly_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_shopify_anomaly_items;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_shopify_anomaly_items TO service_role;

-- Rewrite the anomalies RPC to read from the mat view (fast reads, wide window)
-- Returns up to 100 sample order refs so users can see all affected orders
-- (especially important for order_ref_as_description which is the SAV workflow).
CREATE OR REPLACE FUNCTION detect_shopify_anomalies(p_tenant_id UUID)
RETURNS TABLE (
  anomaly_type TEXT,
  raw_sku TEXT,
  raw_description TEXT,
  nb_occurrences BIGINT,
  total_qty BIGINT,
  sample_order_refs TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    anomaly_type::text,
    raw_sku::text,
    raw_description::text,
    COUNT(*)::bigint AS nb_occurrences,
    SUM(qty)::bigint AS total_qty,
    (array_agg(order_ref ORDER BY shipped_at DESC) FILTER (WHERE order_ref IS NOT NULL))[1:100]::text[]
      AS sample_order_refs
  FROM mv_shopify_anomaly_items
  WHERE tenant_id = p_tenant_id
    AND anomaly_type IS NOT NULL
  GROUP BY anomaly_type, raw_sku, raw_description
  ORDER BY SUM(qty) DESC;
$$;

GRANT EXECUTE ON FUNCTION detect_shopify_anomalies TO service_role, authenticated;

-- Update the consolidated refresh function to also refresh this view
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
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_shopify_anomaly_items;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_all_analytics_views TO service_role;

-- Initial population
REFRESH MATERIALIZED VIEW mv_shopify_anomaly_items;
