CREATE OR REPLACE FUNCTION public.get_products_metrics(p_tenant_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_products_volume bigint := 0;
  v_total_bundles_volume bigint := 0;
  v_total_products int := 0;
  v_total_bundles int := 0;
  v_top_products jsonb;
  v_top_bundles jsonb;
  v_monthly jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(vp.physical_qty), 0)::bigint, COUNT(DISTINCT vp.sku_id)::int
  INTO v_total_products_volume, v_total_products
  FROM v_physical_shipment_items vp
  WHERE vp.tenant_id = p_tenant_id
    AND vp.is_return = false
    AND vp.shipped_at >= p_start_date
    AND vp.shipped_at <= p_end_date;

  SELECT COALESCE(SUM(si.qty), 0)::bigint, COUNT(DISTINCT si.sku_id)::int
  INTO v_total_bundles_volume, v_total_bundles
  FROM shipment_items si
  JOIN shipments sh ON sh.id = si.shipment_id
  WHERE si.tenant_id = p_tenant_id
    AND sh.is_return = false
    AND sh.shipped_at >= p_start_date
    AND sh.shipped_at <= p_end_date
    AND EXISTS (SELECT 1 FROM bundles b WHERE b.bundle_sku_id = si.sku_id AND b.tenant_id = p_tenant_id);

  SELECT COALESCE(jsonb_agg(p ORDER BY p.volume DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT vp.sku_id, s.sku_code, s.name, SUM(vp.physical_qty)::bigint AS volume
    FROM v_physical_shipment_items vp
    JOIN skus s ON s.id = vp.sku_id
    WHERE vp.tenant_id = p_tenant_id AND vp.is_return = false
      AND vp.shipped_at >= p_start_date AND vp.shipped_at <= p_end_date
    GROUP BY vp.sku_id, s.sku_code, s.name
    ORDER BY SUM(vp.physical_qty) DESC
    LIMIT p_limit
  ) p;

  SELECT COALESCE(jsonb_agg(b ORDER BY b.volume DESC), '[]'::jsonb)
  INTO v_top_bundles
  FROM (
    SELECT si.sku_id, s.sku_code, s.name, SUM(si.qty)::bigint AS volume
    FROM shipment_items si
    JOIN shipments sh ON sh.id = si.shipment_id
    JOIN skus s ON s.id = si.sku_id
    WHERE si.tenant_id = p_tenant_id AND sh.is_return = false
      AND sh.shipped_at >= p_start_date AND sh.shipped_at <= p_end_date
      AND EXISTS (SELECT 1 FROM bundles bd WHERE bd.bundle_sku_id = si.sku_id AND bd.tenant_id = p_tenant_id)
    GROUP BY si.sku_id, s.sku_code, s.name
    ORDER BY SUM(si.qty) DESC
    LIMIT p_limit
  ) b;

  WITH products_monthly AS (
    SELECT TO_CHAR(vp.shipped_at, 'YYYY-MM') AS month_key, SUM(vp.physical_qty)::bigint AS products
    FROM v_physical_shipment_items vp
    WHERE vp.tenant_id = p_tenant_id AND vp.is_return = false
      AND vp.shipped_at >= p_start_date AND vp.shipped_at <= p_end_date
    GROUP BY TO_CHAR(vp.shipped_at, 'YYYY-MM')
  ),
  bundles_monthly AS (
    SELECT TO_CHAR(sh.shipped_at, 'YYYY-MM') AS month_key, SUM(si.qty)::bigint AS bundles
    FROM shipment_items si
    JOIN shipments sh ON sh.id = si.shipment_id
    WHERE si.tenant_id = p_tenant_id AND sh.is_return = false
      AND sh.shipped_at >= p_start_date AND sh.shipped_at <= p_end_date
      AND EXISTS (SELECT 1 FROM bundles b WHERE b.bundle_sku_id = si.sku_id AND b.tenant_id = p_tenant_id)
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
$function$;
