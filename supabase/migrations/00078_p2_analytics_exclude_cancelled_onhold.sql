-- "Unites vendues par produit" doit compter uniquement ce qui est reellement
-- PARTI de l'entrepot. On exclut donc les commandes On Hold / Cancelled /
-- Unfulfilled (pas expediees), comme le fait deja la facturation.
-- Ca retire notamment les commandes On Hold dont la quantite s'etait gonflee
-- par re-telechargement a chaque synchro (bug d'accumulation historique).

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
    AND COALESCE(vp.status_message,'') NOT IN ('On Hold','Cancelled','Cancelled - customer','Unfulfilled')
    AND vp.shipped_at >= p_start_date
    AND vp.shipped_at <= p_end_date
  GROUP BY vp.sku_id, s.sku_code, s.name
  ORDER BY quantity_sold DESC;
END;
$function$;
