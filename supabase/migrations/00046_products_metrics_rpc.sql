-- Migration 00046: RPC to replace the 180-roundtrip products-metrics pagination loop
--
-- The old client route paginated v_physical_shipment_items and shipment_items 1000 at a time.
-- This RPC does the full aggregation server-side in one call, reading from the (indexed)
-- materialized view v_physical_shipment_items and shipment_items for bundle line items.

CREATE OR REPLACE FUNCTION get_products_metrics(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INT DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_products_volume bigint := 0;
  v_total_bundles_volume bigint := 0;
  v_total_products int := 0;
  v_total_bundles int := 0;
  v_top_products jsonb;
  v_top_bundles jsonb;
  v_monthly jsonb;
BEGIN
  -- Totals (physical products, decomposed)
  SELECT
    COALESCE(SUM(vp.physical_qty), 0)::bigint,
    COUNT(DISTINCT vp.sku_id)::int
  INTO v_total_products_volume, v_total_products
  FROM v_physical_shipment_items vp
  WHERE vp.tenant_id = p_tenant_id
    AND vp.is_return = false
    AND vp.shipped_at >= p_start_date
    AND vp.shipped_at <= p_end_date;

  -- Totals (bundle line items, as sold)
  SELECT
    COALESCE(SUM(si.qty), 0)::bigint,
    COUNT(DISTINCT si.sku_id)::int
  INTO v_total_bundles_volume, v_total_bundles
  FROM shipment_items si
  JOIN shipments sh ON sh.id = si.shipment_id
  WHERE si.tenant_id = p_tenant_id
    AND sh.is_return = false
    AND sh.shipped_at >= p_start_date
    AND sh.shipped_at <= p_end_date
    AND EXISTS (
      SELECT 1 FROM bundles b
      WHERE b.bundle_sku_id = si.sku_id AND b.tenant_id = p_tenant_id
    );

  -- Top products by physical volume
  SELECT COALESCE(jsonb_agg(p ORDER BY p.volume DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT
      vp.sku_id,
      s.sku_code,
      s.name,
      SUM(vp.physical_qty)::bigint AS volume
    FROM v_physical_shipment_items vp
    JOIN skus s ON s.id = vp.sku_id
    WHERE vp.tenant_id = p_tenant_id
      AND vp.is_return = false
      AND vp.shipped_at >= p_start_date
      AND vp.shipped_at <= p_end_date
    GROUP BY vp.sku_id, s.sku_code, s.name
    ORDER BY SUM(vp.physical_qty) DESC
    LIMIT p_limit
  ) p;

  -- Top bundles by line-item volume
  SELECT COALESCE(jsonb_agg(b ORDER BY b.volume DESC), '[]'::jsonb)
  INTO v_top_bundles
  FROM (
    SELECT
      si.sku_id,
      s.sku_code,
      s.name,
      SUM(si.qty)::bigint AS volume
    FROM shipment_items si
    JOIN shipments sh ON sh.id = si.shipment_id
    JOIN skus s ON s.id = si.sku_id
    WHERE si.tenant_id = p_tenant_id
      AND sh.is_return = false
      AND sh.shipped_at >= p_start_date
      AND sh.shipped_at <= p_end_date
      AND EXISTS (
        SELECT 1 FROM bundles bd
        WHERE bd.bundle_sku_id = si.sku_id AND bd.tenant_id = p_tenant_id
      )
    GROUP BY si.sku_id, s.sku_code, s.name
    ORDER BY SUM(si.qty) DESC
    LIMIT p_limit
  ) b;

  -- Monthly breakdown: products (decomposed) + bundles (as sold)
  WITH products_monthly AS (
    SELECT
      TO_CHAR(vp.shipped_at, 'YYYY-MM') AS month_key,
      SUM(vp.physical_qty)::bigint AS products
    FROM v_physical_shipment_items vp
    WHERE vp.tenant_id = p_tenant_id
      AND vp.is_return = false
      AND vp.shipped_at >= p_start_date
      AND vp.shipped_at <= p_end_date
    GROUP BY TO_CHAR(vp.shipped_at, 'YYYY-MM')
  ),
  bundles_monthly AS (
    SELECT
      TO_CHAR(sh.shipped_at, 'YYYY-MM') AS month_key,
      SUM(si.qty)::bigint AS bundles
    FROM shipment_items si
    JOIN shipments sh ON sh.id = si.shipment_id
    WHERE si.tenant_id = p_tenant_id
      AND sh.is_return = false
      AND sh.shipped_at >= p_start_date
      AND sh.shipped_at <= p_end_date
      AND EXISTS (
        SELECT 1 FROM bundles b
        WHERE b.bundle_sku_id = si.sku_id AND b.tenant_id = p_tenant_id
      )
    GROUP BY TO_CHAR(sh.shipped_at, 'YYYY-MM')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', COALESCE(pm.month_key, bm.month_key),
    'products', COALESCE(pm.products, 0),
    'bundles', COALESCE(bm.bundles, 0)
  )), '[]'::jsonb)
  INTO v_monthly
  FROM products_monthly pm
  FULL OUTER JOIN bundles_monthly bm ON pm.month_key = bm.month_key;

  RETURN jsonb_build_object(
    'topProducts', v_top_products,
    'topBundles', v_top_bundles,
    'monthlyVolumes', v_monthly,
    'summary', jsonb_build_object(
      'totalProducts', v_total_products,
      'totalBundles', v_total_bundles,
      'totalProductsVolume', v_total_products_volume,
      'totalBundlesVolume', v_total_bundles_volume
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_products_metrics TO service_role, authenticated;
