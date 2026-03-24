-- Analytics RPC functions for dashboard charts and reporting
-- These are called from the frontend analytics pages

-- 1. Monthly shipment aggregates with claim data
CREATE OR REPLACE FUNCTION analytics_monthly_shipments(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  month TEXT,
  shipments BIGINT,
  cost NUMERIC,
  claims BIGINT,
  indemnity NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sh.month,
    sh.shipments,
    sh.cost,
    COALESCE(cl.claims, 0) AS claims,
    COALESCE(cl.indemnity, 0) AS indemnity
  FROM (
    SELECT
      TO_CHAR(s.shipped_at, 'YYYY-MM') AS month,
      COUNT(*) AS shipments,
      COALESCE(SUM(s.computed_cost_eur), 0) AS cost
    FROM shipments s
    WHERE s.tenant_id = p_tenant_id
      AND s.shipped_at >= p_start_date
      AND s.shipped_at <= p_end_date
      AND s.is_return = false
    GROUP BY TO_CHAR(s.shipped_at, 'YYYY-MM')
  ) sh
  LEFT JOIN (
    SELECT
      TO_CHAR(c.decided_at, 'YYYY-MM') AS month,
      COUNT(*) AS claims,
      COALESCE(SUM(c.indemnity_eur), 0) AS indemnity
    FROM claims c
    WHERE c.tenant_id = p_tenant_id
      AND c.status = 'indemnisee'
      AND c.decided_at >= p_start_date
      AND c.decided_at <= p_end_date
    GROUP BY TO_CHAR(c.decided_at, 'YYYY-MM')
  ) cl ON sh.month = cl.month
  ORDER BY sh.month;
$$;

GRANT EXECUTE ON FUNCTION analytics_monthly_shipments TO service_role;


-- 2. SKU sales ranking within a date range
CREATE OR REPLACE FUNCTION analytics_sku_sales(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  sku_id UUID,
  sku_code TEXT,
  name TEXT,
  quantity_sold BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.sku_id,
    s.sku_code,
    s.name,
    SUM(si.qty)::BIGINT AS quantity_sold
  FROM shipment_items si
  JOIN skus s ON si.sku_id = s.id
  JOIN shipments sh ON si.shipment_id = sh.id
  WHERE si.tenant_id = p_tenant_id
    AND sh.shipped_at >= p_start_date
    AND sh.shipped_at <= p_end_date
    AND sh.is_return = false
  GROUP BY si.sku_id, s.sku_code, s.name
  ORDER BY quantity_sold DESC;
$$;

GRANT EXECUTE ON FUNCTION analytics_sku_sales TO service_role;


-- 3. Daily shipment aggregates for bar charts
CREATE OR REPLACE FUNCTION get_daily_shipments_aggregated(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  day DATE,
  shipments BIGINT,
  cost NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.shipped_at::date AS day,
    COUNT(*) AS shipments,
    COALESCE(SUM(s.computed_cost_eur), 0) AS cost
  FROM shipments s
  WHERE s.tenant_id = p_tenant_id
    AND s.shipped_at >= p_start_date
    AND s.shipped_at <= p_end_date
  GROUP BY s.shipped_at::date
  ORDER BY day;
$$;

GRANT EXECUTE ON FUNCTION get_daily_shipments_aggregated TO service_role;


-- 4. SKU consumption metrics (90d and 30d) for stock health
CREATE OR REPLACE FUNCTION get_sku_consumption_metrics(
  p_tenant_id UUID
)
RETURNS TABLE (
  sku_id UUID,
  total_qty_90d BIGINT,
  total_qty_30d BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.sku_id,
    SUM(si.qty)::BIGINT AS total_qty_90d,
    SUM(si.qty) FILTER (WHERE sh.shipped_at >= NOW() - INTERVAL '30 days')::BIGINT AS total_qty_30d
  FROM shipment_items si
  JOIN shipments sh ON si.shipment_id = sh.id
  WHERE si.tenant_id = p_tenant_id
    AND sh.shipped_at >= NOW() - INTERVAL '90 days'
    AND sh.is_return = false
  GROUP BY si.sku_id;
$$;

GRANT EXECUTE ON FUNCTION get_sku_consumption_metrics TO service_role;
