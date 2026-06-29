-- analytics_sku_sales recalculait la decomposition des bundles a la volee
-- (~20s sur Florna) -> timeout PostgREST -> le graphe "Unites vendues par
-- produit" affichait 0. On lit desormais la mat view v_physical_shipment_items
-- (deja decomposee, indexee sur tenant_id+shipped_at) -> ~3s. Garde le tenant
-- guard.

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
  SELECT vp.sku_id, s.sku_code, s.name, SUM(vp.physical_qty)::bigint AS quantity_sold
  FROM v_physical_shipment_items vp
  JOIN skus s ON s.id = vp.sku_id
  WHERE vp.tenant_id = p_tenant_id
    AND vp.is_return = false
    AND vp.shipped_at >= p_start_date
    AND vp.shipped_at <= p_end_date
  GROUP BY vp.sku_id, s.sku_code, s.name
  ORDER BY quantity_sold DESC;
END;
$function$;
