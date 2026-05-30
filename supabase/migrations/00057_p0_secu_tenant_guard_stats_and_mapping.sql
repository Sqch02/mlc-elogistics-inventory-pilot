CREATE OR REPLACE FUNCTION public.get_shipment_stats(p_tenant_id uuid, p_from text DEFAULT NULL::text, p_to text DEFAULT NULL::text, p_carrier text DEFAULT NULL::text, p_pricing_status text DEFAULT NULL::text, p_shipment_status text DEFAULT NULL::text, p_delivery_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_problem_ids INT[] := ARRAY[1002, 1337, 8, 80, 62996, 62992, 62991, 2000];
  v_transit_ids INT[] := ARRAY[1, 3, 7, 12, 22, 91, 92, 62989, 62990];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'totalCost', COALESCE(SUM(s.computed_cost_eur), 0),
    'totalValue', COALESCE(SUM(s.total_value), 0),
    'missingPricing', COUNT(*) FILTER (WHERE s.pricing_status = 'missing'::pricing_status)
  )
  INTO v_result
  FROM shipments s
  WHERE s.tenant_id = p_tenant_id
    AND (p_from IS NULL OR s.shipped_at >= p_from::timestamptz)
    AND (p_to IS NULL OR s.shipped_at <= p_to::timestamptz)
    AND (p_carrier IS NULL OR s.carrier ILIKE p_carrier)
    AND (p_pricing_status IS NULL OR s.pricing_status = p_pricing_status::pricing_status)
    AND (
      p_shipment_status IS NULL
      OR (p_shipment_status = 'pending' AND s.status_id IS NULL)
      OR (p_shipment_status = 'shipped' AND s.status_id IS NOT NULL)
    )
    AND (
      p_delivery_status IS NULL
      OR (p_delivery_status = 'issue' AND p_shipment_status = 'pending' AND s.has_error = true)
      OR (p_delivery_status = 'issue' AND COALESCE(p_shipment_status, '') != 'pending'
          AND s.status_id = ANY(v_problem_ids))
      OR (p_delivery_status = 'delivered' AND s.status_id = 11)
      OR (p_delivery_status = 'in_transit' AND s.status_id = ANY(v_transit_ids))
    )
    AND (
      p_search IS NULL
      OR s.order_ref ILIKE '%' || p_search || '%'
      OR s.tracking ILIKE '%' || p_search || '%'
      OR s.sendcloud_id ILIKE '%' || p_search || '%'
    );

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.map_shipment_item(p_tenant_id uuid, p_raw_sku text, p_raw_description text, p_raw_variant_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sku_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  IF p_raw_sku IS NOT NULL AND p_raw_sku != '' THEN
    SELECT id INTO v_sku_id FROM skus
    WHERE tenant_id = p_tenant_id AND sku_code = p_raw_sku
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;

    SELECT id INTO v_sku_id FROM skus
    WHERE tenant_id = p_tenant_id
    AND LOWER(TRIM(sku_code)) = LOWER(TRIM(p_raw_sku))
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  IF p_raw_variant_id IS NOT NULL AND p_raw_variant_id != '' THEN
    SELECT id INTO v_sku_id FROM skus
    WHERE tenant_id = p_tenant_id AND shopify_variant_id = p_raw_variant_id
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  IF p_raw_variant_id IS NOT NULL AND p_raw_variant_id != '' THEN
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings
    WHERE tenant_id = p_tenant_id AND source = 'variant_id' AND pattern = p_raw_variant_id
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  IF p_raw_sku IS NOT NULL AND p_raw_sku != '' THEN
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings
    WHERE tenant_id = p_tenant_id AND source = 'sku_alias'
    AND (
      (match_type = 'exact' AND pattern = p_raw_sku) OR
      (match_type = 'ilike' AND LOWER(pattern) = LOWER(p_raw_sku))
    )
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  IF p_raw_description IS NOT NULL AND p_raw_description != '' THEN
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings
    WHERE tenant_id = p_tenant_id AND source = 'description'
    AND (
      (match_type = 'exact' AND pattern = p_raw_description) OR
      (match_type = 'ilike' AND LOWER(p_raw_description) LIKE LOWER(pattern)) OR
      (match_type = 'contains' AND LOWER(p_raw_description) LIKE '%' || LOWER(pattern) || '%')
    )
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  RETURN NULL;
END;
$function$;
