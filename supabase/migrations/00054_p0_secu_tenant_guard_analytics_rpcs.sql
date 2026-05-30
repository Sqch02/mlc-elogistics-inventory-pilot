-- P0 Security: Add tenant_id guard to analytics RPCs that take p_tenant_id parameter.
-- Pattern: authenticated users may only query their own tenant; super_admin and
-- service_role (auth.uid IS NULL) bypass the check.

CREATE OR REPLACE FUNCTION public.analytics_monthly_shipments(p_tenant_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(month text, shipments bigint, cost numeric, claims bigint, indemnity numeric)
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
    sh.month, sh.shipments, sh.cost,
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
END;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_sku_sales(p_tenant_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(sku_id uuid, sku_code text, name text, quantity_sold bigint)
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
  WITH raw_items AS (
    SELECT si.sku_id, si.qty
    FROM shipment_items si
    JOIN shipments sh ON si.shipment_id = sh.id
    WHERE si.tenant_id = p_tenant_id
      AND sh.shipped_at >= p_start_date
      AND sh.shipped_at <= p_end_date
      AND sh.is_return = false
  ),
  decomposed AS (
    SELECT
      bc.component_sku_id AS sku_id,
      ri.qty * bc.qty_component AS qty
    FROM raw_items ri
    JOIN bundles b ON b.bundle_sku_id = ri.sku_id AND b.tenant_id = p_tenant_id
    JOIN bundle_components bc ON bc.bundle_id = b.id
    UNION ALL
    SELECT ri.sku_id, ri.qty
    FROM raw_items ri
    WHERE NOT EXISTS (
      SELECT 1 FROM bundles b
      WHERE b.bundle_sku_id = ri.sku_id AND b.tenant_id = p_tenant_id
    )
  )
  SELECT d.sku_id, s.sku_code, s.name, SUM(d.qty)::BIGINT
  FROM decomposed d
  JOIN skus s ON d.sku_id = s.id
  GROUP BY d.sku_id, s.sku_code, s.name
  ORDER BY SUM(d.qty) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.detect_shopify_anomalies(p_tenant_id uuid)
 RETURNS TABLE(anomaly_type text, raw_sku text, raw_description text, nb_occurrences bigint, total_qty bigint, sample_order_refs text[])
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
    a.anomaly_type::text,
    a.raw_sku::text,
    a.raw_description::text,
    COUNT(*)::bigint,
    SUM(a.qty)::bigint,
    (array_agg(a.order_ref ORDER BY a.shipped_at DESC) FILTER (WHERE a.order_ref IS NOT NULL))[1:100]::text[]
  FROM mv_shopify_anomaly_items a
  WHERE a.tenant_id = p_tenant_id
    AND a.anomaly_type IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM dismissed_anomalies d
      WHERE d.tenant_id = a.tenant_id
        AND d.anomaly_type = a.anomaly_type
        AND COALESCE(d.raw_sku, '') = COALESCE(a.raw_sku, '')
        AND COALESCE(d.raw_description, '') = COALESCE(a.raw_description, '')
    )
  GROUP BY a.anomaly_type, a.raw_sku, a.raw_description
  ORDER BY SUM(a.qty) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_carrier_performance(p_tenant_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(carrier text, shipments bigint, total_cost numeric, avg_cost numeric, claims bigint, claim_rate numeric)
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
  WITH carrier_shipments AS (
    SELECT
      LOWER(COALESCE(s.carrier, 'unknown')) AS carrier,
      COUNT(*)::bigint AS shipments,
      COALESCE(SUM(s.computed_cost_eur), 0)::numeric(14,2) AS total_cost
    FROM shipments s
    WHERE s.tenant_id = p_tenant_id
      AND s.is_return = false
      AND s.shipped_at >= p_start_date
      AND s.shipped_at <= p_end_date
    GROUP BY LOWER(COALESCE(s.carrier, 'unknown'))
  ),
  carrier_claims AS (
    SELECT
      LOWER(COALESCE(s.carrier, 'unknown')) AS carrier,
      COUNT(*)::bigint AS claims
    FROM claims c
    JOIN shipments s ON s.id = c.shipment_id
    WHERE c.tenant_id = p_tenant_id
      AND c.opened_at >= p_start_date
      AND c.opened_at <= p_end_date
    GROUP BY LOWER(COALESCE(s.carrier, 'unknown'))
  )
  SELECT
    cs.carrier, cs.shipments, cs.total_cost,
    CASE WHEN cs.shipments > 0 THEN ROUND((cs.total_cost / cs.shipments)::numeric, 2) ELSE 0::numeric END,
    COALESCE(cc.claims, 0)::bigint,
    CASE WHEN cs.shipments > 0 THEN ROUND((COALESCE(cc.claims, 0)::numeric / cs.shipments * 100)::numeric, 2) ELSE 0::numeric END
  FROM carrier_shipments cs
  LEFT JOIN carrier_claims cc ON cc.carrier = cs.carrier
  ORDER BY cs.shipments DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_shipments_aggregated(p_tenant_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(day date, shipments bigint, cost numeric)
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
    s.shipped_at::date,
    COUNT(*)::bigint,
    COALESCE(SUM(s.computed_cost_eur), 0)::numeric
  FROM shipments s
  WHERE s.tenant_id = p_tenant_id
    AND s.shipped_at >= p_start_date
    AND s.shipped_at <= p_end_date
  GROUP BY s.shipped_at::date
  ORDER BY 1;
END;
$function$;
