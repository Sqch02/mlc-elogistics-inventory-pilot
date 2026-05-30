-- P0 Security: Tenant guard on dashboard / metrics / cursor RPCs.

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_tenant_id uuid, p_month_start date, p_month_end date, p_yesterday date)
 RETURNS TABLE(metric text, day date, shipments_count bigint, shipments_cost numeric, shipments_missing_pricing bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 'month'::text, NULL::date,
    COALESCE(SUM(shipments_count), 0)::bigint,
    COALESCE(SUM(shipments_cost), 0)::numeric,
    COALESCE(SUM(shipments_missing_pricing), 0)::bigint
  FROM mv_dashboard_daily
  WHERE tenant_id = p_tenant_id
    AND mv_dashboard_daily.day >= p_month_start
    AND mv_dashboard_daily.day <= p_month_end
  UNION ALL
  SELECT 'all_time_missing'::text, NULL::date,
    0::bigint, 0::numeric,
    COALESCE(SUM(shipments_missing_pricing), 0)::bigint
  FROM mv_dashboard_daily
  WHERE tenant_id = p_tenant_id
  UNION ALL
  SELECT 'yesterday'::text, p_yesterday,
    COALESCE(shipments_count, 0)::bigint,
    COALESCE(shipments_cost, 0)::numeric,
    COALESCE(shipments_missing_pricing, 0)::bigint
  FROM mv_dashboard_daily
  WHERE tenant_id = p_tenant_id AND mv_dashboard_daily.day = p_yesterday
  UNION ALL
  SELECT 'day'::text, mv_dashboard_daily.day,
    shipments_count, shipments_cost, shipments_missing_pricing
  FROM mv_dashboard_daily
  WHERE tenant_id = p_tenant_id
    AND mv_dashboard_daily.day >= p_month_start
    AND mv_dashboard_daily.day <= p_month_end
  ORDER BY metric, day;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sku_consumption_metrics(p_tenant_id uuid)
 RETURNS TABLE(sku_id uuid, total_qty_90d bigint, total_qty_30d bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    si.sku_id,
    SUM(si.qty)::BIGINT,
    SUM(si.qty) FILTER (WHERE sh.shipped_at >= NOW() - INTERVAL '30 days')::BIGINT
  FROM shipment_items si
  JOIN shipments sh ON si.shipment_id = sh.id
  WHERE si.tenant_id = p_tenant_id
    AND sh.shipped_at >= NOW() - INTERVAL '90 days'
    AND sh.is_return = false
  GROUP BY si.sku_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_last_sync_cursor(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cursor text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT cursor INTO v_cursor
  FROM sync_runs
  WHERE tenant_id = p_tenant_id
    AND status = 'success'
    AND cursor IS NOT NULL
  ORDER BY ended_at DESC
  LIMIT 1;
  RETURN v_cursor;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_last_sync_cursor(p_tenant_id uuid, p_source text DEFAULT 'sendcloud'::text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_cursor TEXT;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
       AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
      RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
    END IF;

    SELECT cursor INTO v_cursor
    FROM sync_runs
    WHERE tenant_id = p_tenant_id
      AND source = p_source
      AND status IN ('success', 'partial')
      AND cursor IS NOT NULL
    ORDER BY ended_at DESC NULLS LAST
    LIMIT 1;
    RETURN v_cursor;
END;
$function$;
