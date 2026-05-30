-- P0 Security: Fix search_path on the 3 RPCs flagged by Supabase advisor
-- (function_search_path_mutable). Without SET search_path, a malicious user
-- with TEMP schema rights could shadow public objects.
--
-- Also adds tenant guard to get_all_claims (audit P0). get_shipping_price stays
-- SECURITY INVOKER (RLS on pricing_rules already enforces tenant isolation).

CREATE OR REPLACE FUNCTION public.get_monthly_indemnities(p_tenant_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(indemnity_eur numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT indemnity_eur
  FROM claims
  WHERE tenant_id = p_tenant_id
    AND status = 'indemnisee'
    AND COALESCE(decided_at, created_at) >= p_start_date
    AND COALESCE(decided_at, created_at) <= p_end_date
    AND (
      auth.uid() IS NULL
      OR public.is_super_admin()
      OR p_tenant_id = public.get_tenant_id()
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_shipping_price(p_tenant_id uuid, p_carrier text, p_weight_grams integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    v_price NUMERIC(10, 2);
BEGIN
    SELECT price_eur INTO v_price
    FROM pricing_rules
    WHERE tenant_id = p_tenant_id
      AND carrier = p_carrier
      AND weight_min_grams <= p_weight_grams
      AND weight_max_grams >= p_weight_grams
    LIMIT 1;

    RETURN v_price;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_claims(p_tenant_id uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, shipment_id uuid, order_ref text, description text, status text, claim_type text, priority text, indemnity_eur numeric, decision_note text, opened_at timestamp with time zone, decided_at timestamp with time zone, resolution_deadline timestamp with time zone, auto_created boolean, sendcloud_status_id integer, sendcloud_status_message text, created_at timestamp with time zone, shipment_sendcloud_id text, shipment_order_ref text, shipment_carrier text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.tenant_id, c.shipment_id, c.order_ref, c.description,
    c.status::TEXT, c.claim_type::TEXT, c.priority::TEXT,
    c.indemnity_eur, c.decision_note, c.opened_at, c.decided_at,
    c.resolution_deadline, c.auto_created, c.sendcloud_status_id,
    c.sendcloud_status_message, c.created_at,
    s.sendcloud_id::TEXT, s.order_ref::TEXT, s.carrier::TEXT
  FROM claims c
  LEFT JOIN shipments s ON s.id = c.shipment_id
  WHERE c.tenant_id = p_tenant_id
  ORDER BY c.opened_at DESC;
END;
$function$;
