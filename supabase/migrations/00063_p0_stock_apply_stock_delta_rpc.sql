-- P0 Stock: Atomic stock delta RPC.
-- Replaces the read-modify-write pattern in decrementSkuStock (consume.ts) which
-- could lose updates under concurrent webhook+cron access (REBORN21 21/05 and
-- ANTEOS 28/05 drift incidents). The function:
-- - Locks the stock_snapshots row FOR UPDATE
-- - Applies GREATEST(0, ...) so qty_current never goes negative
-- - Decomposes bundles into their components
-- - Records the movement in stock_movements with full trace

CREATE OR REPLACE FUNCTION public.apply_stock_delta(
  p_tenant_id uuid,
  p_sku_id uuid,
  p_delta integer,
  p_reason text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_movement_type text DEFAULT NULL
) RETURNS TABLE(sku_id uuid, qty_before integer, qty_after integer, was_bundle boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bundle_id uuid;
  v_component RECORD;
  v_qty_before integer;
  v_qty_after integer;
  v_movement_type text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT b.id INTO v_bundle_id
  FROM bundles b
  WHERE b.bundle_sku_id = p_sku_id AND b.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_bundle_id IS NOT NULL THEN
    FOR v_component IN
      SELECT bc.component_sku_id, bc.qty_component
      FROM bundle_components bc
      WHERE bc.bundle_id = v_bundle_id
    LOOP
      RETURN QUERY
      SELECT * FROM public.apply_stock_delta(
        p_tenant_id,
        v_component.component_sku_id,
        p_delta * v_component.qty_component,
        p_reason,
        p_reference_id,
        p_reference_type,
        p_user_id,
        p_movement_type
      );
    END LOOP;
    RETURN;
  END IF;

  SELECT qty_current INTO v_qty_before
  FROM stock_snapshots
  WHERE stock_snapshots.sku_id = p_sku_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_qty_before := 0;
    v_qty_after := GREATEST(0, p_delta);
    INSERT INTO stock_snapshots (tenant_id, sku_id, qty_current, updated_at)
    VALUES (p_tenant_id, p_sku_id, v_qty_after, now());
  ELSE
    v_qty_after := GREATEST(0, v_qty_before + p_delta);
    UPDATE stock_snapshots
    SET qty_current = v_qty_after, updated_at = now()
    WHERE stock_snapshots.sku_id = p_sku_id;
  END IF;

  v_movement_type := COALESCE(
    p_movement_type,
    CASE WHEN p_delta < 0 THEN 'shipment' ELSE 'restock' END
  );

  INSERT INTO stock_movements (
    tenant_id, sku_id, qty_before, qty_after, adjustment,
    movement_type, reason, reference_id, reference_type, user_id, created_at
  ) VALUES (
    p_tenant_id, p_sku_id, v_qty_before, v_qty_after, p_delta,
    v_movement_type, p_reason, p_reference_id, p_reference_type, p_user_id, now()
  );

  RETURN QUERY SELECT p_sku_id, v_qty_before, v_qty_after, false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_stock_delta(uuid, uuid, integer, text, uuid, text, uuid, text) FROM anon, authenticated;
