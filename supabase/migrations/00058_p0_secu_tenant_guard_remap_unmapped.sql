-- Both remap_unmapped_items overloads get tenant guard. Note: the v2 (no p_limit)
-- still has the audit bugs (negative qty_current, no stock_movements, no bundle
-- decomposition). Those are fixed in the P0-stock phase. Here we only add the
-- security guard.

CREATE OR REPLACE FUNCTION public.remap_unmapped_items(p_tenant_id uuid)
 RETURNS TABLE(resolved integer, still_unmapped integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resolved INTEGER := 0;
  v_item RECORD;
  v_sku_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT * FROM unmapped_items
    WHERE tenant_id = p_tenant_id AND resolved_at IS NULL
  LOOP
    v_sku_id := map_shipment_item(p_tenant_id, v_item.raw_sku, v_item.raw_description, v_item.raw_variant_id);

    IF v_sku_id IS NOT NULL THEN
      INSERT INTO shipment_items (tenant_id, shipment_id, sku_id, qty)
      VALUES (v_item.tenant_id, v_item.shipment_id, v_sku_id, v_item.qty)
      ON CONFLICT (shipment_id, sku_id) DO UPDATE
        SET qty = shipment_items.qty + EXCLUDED.qty;

      INSERT INTO stock_snapshots (tenant_id, sku_id, qty_current, updated_at)
      VALUES (v_item.tenant_id, v_sku_id, -v_item.qty, now())
      ON CONFLICT (sku_id) DO UPDATE
        SET qty_current = stock_snapshots.qty_current - v_item.qty,
            updated_at = now();

      UPDATE unmapped_items
      SET resolved_at = now(), resolved_sku_id = v_sku_id
      WHERE id = v_item.id;

      v_resolved := v_resolved + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_resolved, (SELECT COUNT(*)::INTEGER FROM unmapped_items WHERE tenant_id = p_tenant_id AND resolved_at IS NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.remap_unmapped_items(p_tenant_id uuid, p_limit integer DEFAULT NULL::integer)
 RETURNS TABLE(resolved integer, still_unmapped integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resolved INTEGER := 0;
  v_item RECORD;
  v_sku_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT * FROM unmapped_items
    WHERE tenant_id = p_tenant_id AND resolved_at IS NULL
    ORDER BY created_at DESC
    LIMIT COALESCE(p_limit, 2147483647)
  LOOP
    v_sku_id := map_shipment_item(p_tenant_id, v_item.raw_sku, v_item.raw_description, v_item.raw_variant_id);

    IF v_sku_id IS NOT NULL THEN
      INSERT INTO shipment_items (tenant_id, shipment_id, sku_id, qty)
      VALUES (v_item.tenant_id, v_item.shipment_id, v_sku_id, v_item.qty)
      ON CONFLICT (shipment_id, sku_id) DO UPDATE
        SET qty = shipment_items.qty + EXCLUDED.qty;

      INSERT INTO stock_snapshots (tenant_id, sku_id, qty_current, updated_at)
      VALUES (v_item.tenant_id, v_sku_id, -v_item.qty, now())
      ON CONFLICT (sku_id) DO UPDATE
        SET qty_current = stock_snapshots.qty_current - v_item.qty,
            updated_at = now();

      UPDATE unmapped_items
      SET resolved_at = now(), resolved_sku_id = v_sku_id
      WHERE id = v_item.id;

      v_resolved := v_resolved + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_resolved, (SELECT COUNT(*)::INTEGER FROM unmapped_items WHERE tenant_id = p_tenant_id AND resolved_at IS NULL);
END;
$function$;
