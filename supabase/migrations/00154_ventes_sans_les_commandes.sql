-- L'analyse des ventes du tableau de bord (produits et bundles) comptait
-- encore les commandes pas encore expediees : On Hold, Unfulfilled,
-- annulees. Elle suit desormais la regle deja appliquee par la facturation
-- et par les ventes par SKU (analytics_sku_sales) : ces statuts sont exclus.
--
-- Les produits viennent de v_physical_shipment_items, qui porte le statut :
-- le filtre s'ajoute dans la fonction. Les bundles viennent de
-- mv_bundle_daily (00150), recreee avec le meme filtre.

DROP MATERIALIZED VIEW public.mv_bundle_daily;
CREATE MATERIALIZED VIEW public.mv_bundle_daily AS
SELECT si.tenant_id,
  date(sh.shipped_at) AS day,
  si.sku_id,
  sum(si.qty)::bigint AS qty
FROM public.shipment_items si
JOIN public.shipments sh ON sh.id = si.shipment_id
WHERE sh.shipped_at IS NOT NULL
  AND sh.is_return = false
  AND COALESCE(sh.status_message, '') NOT IN ('On Hold', 'Cancelled', 'Cancelled - customer', 'Unfulfilled')
  AND EXISTS (
    SELECT 1 FROM public.bundles b
    WHERE b.bundle_sku_id = si.sku_id AND b.tenant_id = si.tenant_id
  )
GROUP BY si.tenant_id, date(sh.shipped_at), si.sku_id;

CREATE UNIQUE INDEX mv_bundle_daily_cle ON public.mv_bundle_daily (tenant_id, day, sku_id);

REVOKE ALL ON public.mv_bundle_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mv_bundle_daily TO service_role;

CREATE OR REPLACE FUNCTION public.get_products_metrics(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
  v_total_products_volume bigint := 0;
  v_total_bundles_volume bigint := 0;
  v_total_products int := 0;
  v_total_bundles int := 0;
  v_top_products jsonb;
  v_top_bundles jsonb;
  v_monthly jsonb;
  v_debut date := (p_start_date AT TIME ZONE 'UTC')::date;
  v_fin date := (p_end_date AT TIME ZONE 'UTC')::date;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(SUM(vp.physical_qty), 0)::bigint,
    COUNT(DISTINCT vp.sku_id)::int
  INTO v_total_products_volume, v_total_products
  FROM public.v_physical_shipment_items vp
  WHERE vp.tenant_id = p_tenant_id
    AND vp.is_return = false
    AND COALESCE(vp.status_message, '') NOT IN ('On Hold', 'Cancelled', 'Cancelled - customer', 'Unfulfilled')
    AND vp.shipped_at >= p_start_date
    AND vp.shipped_at <= p_end_date;

  SELECT
    COALESCE(SUM(bd.qty), 0)::bigint,
    COUNT(DISTINCT bd.sku_id)::int
  INTO v_total_bundles_volume, v_total_bundles
  FROM public.mv_bundle_daily bd
  WHERE bd.tenant_id = p_tenant_id
    AND bd.day >= v_debut
    AND bd.day <= v_fin;

  SELECT COALESCE(jsonb_agg(p ORDER BY p.volume DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT vp.sku_id, s.sku_code, s.name, SUM(vp.physical_qty)::bigint AS volume
    FROM public.v_physical_shipment_items vp
    JOIN public.skus s ON s.id = vp.sku_id
    WHERE vp.tenant_id = p_tenant_id
      AND vp.is_return = false
      AND COALESCE(vp.status_message, '') NOT IN ('On Hold', 'Cancelled', 'Cancelled - customer', 'Unfulfilled')
      AND vp.shipped_at >= p_start_date
      AND vp.shipped_at <= p_end_date
    GROUP BY vp.sku_id, s.sku_code, s.name
    ORDER BY SUM(vp.physical_qty) DESC
    LIMIT p_limit
  ) p;

  SELECT COALESCE(jsonb_agg(b ORDER BY b.volume DESC), '[]'::jsonb)
  INTO v_top_bundles
  FROM (
    SELECT bd.sku_id, s.sku_code, s.name, SUM(bd.qty)::bigint AS volume
    FROM public.mv_bundle_daily bd
    JOIN public.skus s ON s.id = bd.sku_id
    WHERE bd.tenant_id = p_tenant_id
      AND bd.day >= v_debut
      AND bd.day <= v_fin
    GROUP BY bd.sku_id, s.sku_code, s.name
    ORDER BY SUM(bd.qty) DESC
    LIMIT p_limit
  ) b;

  WITH products_monthly AS (
    SELECT TO_CHAR(vp.shipped_at, 'YYYY-MM') AS month_key,
      SUM(vp.physical_qty)::bigint AS products
    FROM public.v_physical_shipment_items vp
    WHERE vp.tenant_id = p_tenant_id
      AND vp.is_return = false
      AND COALESCE(vp.status_message, '') NOT IN ('On Hold', 'Cancelled', 'Cancelled - customer', 'Unfulfilled')
      AND vp.shipped_at >= p_start_date
      AND vp.shipped_at <= p_end_date
    GROUP BY TO_CHAR(vp.shipped_at, 'YYYY-MM')
  ),
  bundles_monthly AS (
    SELECT TO_CHAR(bd.day, 'YYYY-MM') AS month_key,
      SUM(bd.qty)::bigint AS bundles
    FROM public.mv_bundle_daily bd
    WHERE bd.tenant_id = p_tenant_id
      AND bd.day >= v_debut
      AND bd.day <= v_fin
    GROUP BY TO_CHAR(bd.day, 'YYYY-MM')
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

REVOKE ALL ON FUNCTION public.get_products_metrics(uuid, timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_products_metrics(uuid, timestamptz, timestamptz, integer) TO authenticated, service_role;
