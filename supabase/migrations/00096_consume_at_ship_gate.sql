-- Consume-at-ship: central predicate, atomic consume/reversal gates and safe remap.
-- FILE ONLY until the client rollout is explicitly approved.

CREATE OR REPLACE FUNCTION public.is_consumable_shipment(
  p_status_id integer,
  p_status_message text,
  p_is_return boolean
) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_is_return, false) = false
     AND (p_status_id IS NULL OR p_status_id NOT IN (2000, 2001))
     AND COALESCE(p_status_message, '') NOT IN
         ('On Hold','Unfulfilled','Processing','','Cancelled','Cancelled - customer');
$$;

REVOKE ALL ON FUNCTION public.is_consumable_shipment(integer, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_consumable_shipment(integer, text, boolean) TO service_role;

-- Legacy shipments could already have a shipment ledger entry while their
-- marker stayed NULL (00062 only backfilled rows with shipped_at). Mark those
-- rows before any transition-based caller or sweeper can see them as missing.
-- Run this migration with sync paused and outside peak hours.
UPDATE public.shipments AS s
SET stock_consumed_at = COALESCE(s.shipped_at, s.created_at, now())
WHERE s.stock_consumed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.stock_movements sm
    WHERE sm.tenant_id = s.tenant_id
      AND sm.reference_id = s.id
      AND sm.reference_type = 'shipment'
      AND sm.movement_type = 'shipment'
  )
  -- A completed shipment/restock cycle is already neutralized. Do not revive
  -- its marker if this idempotent migration is replayed after rollout.
  AND NOT EXISTS (
    SELECT 1
    FROM public.stock_movements sm
    WHERE sm.tenant_id = s.tenant_id
      AND sm.reference_id = s.id
      AND sm.reference_type = 'shipment'
      AND sm.movement_type = 'restock'
  );

CREATE OR REPLACE FUNCTION public.consume_shipment_stock(
  p_tenant_id uuid,
  p_shipment_id uuid
) RETURNS TABLE(consumed boolean, item_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed integer;
  v_count integer := 0;
  v_status_id integer;
  v_status_message text;
  v_is_return boolean;
  v_item record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  -- Lock status and claim in the same transaction so a concurrent cancel cannot
  -- race between the consumability check and stock_consumed_at CAS.
  SELECT s.status_id, s.status_message, s.is_return
    INTO v_status_id, v_status_message, v_is_return
  FROM public.shipments s
  WHERE s.id = p_shipment_id AND s.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT public.is_consumable_shipment(v_status_id, v_status_message, v_is_return)
     OR NOT EXISTS (
       SELECT 1 FROM public.shipment_items si
       WHERE si.tenant_id = p_tenant_id AND si.shipment_id = p_shipment_id
     ) THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  UPDATE public.shipments
  SET stock_consumed_at = now()
  WHERE id = p_shipment_id
    AND tenant_id = p_tenant_id
    AND stock_consumed_at IS NULL
    -- Defense in depth for a legacy/environment-drift row whose marker was not
    -- backfilled. A neutralized shipment/restock cycle has net effect zero and
    -- may legitimately be consumed again after a re-send.
    AND NOT EXISTS (
      SELECT 1
      FROM public.stock_movements sm
      WHERE sm.tenant_id = p_tenant_id
        AND sm.reference_id = p_shipment_id
        AND sm.reference_type = 'shipment'
        AND sm.movement_type IN ('shipment', 'restock')
      GROUP BY sm.sku_id
      HAVING SUM(sm.qty_before - sm.qty_after) > 0
    );
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  IF v_claimed = 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Stable SKU order reduces deadlock risk when two shipments share components.
  FOR v_item IN
    SELECT si.sku_id, si.qty
    FROM public.shipment_items si
    WHERE si.tenant_id = p_tenant_id AND si.shipment_id = p_shipment_id
    ORDER BY si.sku_id
  LOOP
    PERFORM public.apply_stock_delta(
      p_tenant_id,
      v_item.sku_id,
      -v_item.qty,
      'Expédition',
      p_shipment_id,
      'shipment',
      NULL::uuid,
      'shipment'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT true, v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_shipment_stock(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_shipment_stock(uuid, uuid) TO service_role;

-- Atomic inverse CAS. The current TypeScript helper cleared the marker before
-- applying deltas, allowing a crash to leave a shipment marked unconsumed but
-- only partly restocked. This RPC locks, restores the movement-ledger net, then
-- clears the marker in one transaction.
CREATE OR REPLACE FUNCTION public.restock_shipment_stock(
  p_tenant_id uuid,
  p_shipment_id uuid,
  p_reason text DEFAULT 'Annulation colis'
) RETURNS TABLE(restocked boolean, item_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_consumed_at timestamptz;
  v_count integer := 0;
  v_delta record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT s.stock_consumed_at
    INTO v_stock_consumed_at
  FROM public.shipments s
  WHERE s.id = p_shipment_id AND s.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_stock_consumed_at IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  FOR v_delta IN
    SELECT
      sm.sku_id,
      GREATEST(0, SUM(sm.qty_before - sm.qty_after))::integer AS qty_to_restore
    FROM public.stock_movements sm
    WHERE sm.tenant_id = p_tenant_id
      AND sm.reference_id = p_shipment_id
      AND sm.reference_type = 'shipment'
      AND sm.movement_type IN ('shipment', 'restock')
    GROUP BY sm.sku_id
    HAVING SUM(sm.qty_before - sm.qty_after) > 0
    ORDER BY sm.sku_id
  LOOP
    PERFORM public.apply_stock_delta(
      p_tenant_id,
      v_delta.sku_id,
      v_delta.qty_to_restore,
      p_reason,
      p_shipment_id,
      'shipment',
      NULL::uuid,
      'restock'
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.shipments
  SET stock_consumed_at = NULL
  WHERE id = p_shipment_id AND tenant_id = p_tenant_id;

  RETURN QUERY SELECT true, v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.restock_shipment_stock(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restock_shipment_stock(uuid, uuid, text) TO service_role;

-- Core bounded overload. Unconsumable shipments are mapped without touching
-- stock. A consumable, never-consumed shipment is consumed once after all its
-- newly mapped rows are inserted. A late mapping on an already-consumed
-- shipment consumes only that new item.
CREATE OR REPLACE FUNCTION public.remap_unmapped_items(
  p_tenant_id uuid,
  p_limit integer DEFAULT NULL::integer
) RETURNS TABLE(resolved integer, still_unmapped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved integer := 0;
  v_item record;
  v_sku_id uuid;
  v_shipment_id uuid;
  v_shipments_to_consume uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  FOR v_item IN
    SELECT
      ui.*,
      s.status_id,
      s.status_message,
      s.is_return,
      s.stock_consumed_at
    FROM public.unmapped_items ui
    JOIN public.shipments s
      ON s.id = ui.shipment_id AND s.tenant_id = ui.tenant_id
    WHERE ui.tenant_id = p_tenant_id AND ui.resolved_at IS NULL
    ORDER BY ui.created_at DESC, ui.id
    LIMIT LEAST(COALESCE(p_limit, 2000), 2000)
    FOR UPDATE OF ui, s SKIP LOCKED
  LOOP
    v_sku_id := public.map_shipment_item(
      p_tenant_id,
      v_item.raw_sku,
      v_item.raw_description,
      v_item.raw_variant_id
    );

    IF v_sku_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.shipment_items (tenant_id, shipment_id, sku_id, qty)
    VALUES (v_item.tenant_id, v_item.shipment_id, v_sku_id, v_item.qty)
    ON CONFLICT (shipment_id, sku_id) DO UPDATE
      SET qty = public.shipment_items.qty + EXCLUDED.qty;

    IF public.is_consumable_shipment(
      v_item.status_id,
      v_item.status_message,
      v_item.is_return
    ) THEN
      IF v_item.stock_consumed_at IS NULL THEN
        IF NOT v_item.shipment_id = ANY(v_shipments_to_consume) THEN
          v_shipments_to_consume := array_append(v_shipments_to_consume, v_item.shipment_id);
        END IF;
      ELSE
        PERFORM public.apply_stock_delta(
          p_tenant_id,
          v_sku_id,
          -v_item.qty,
          'Remap rétroactif - item ajouté après consommation',
          v_item.shipment_id,
          'shipment',
          NULL::uuid,
          'shipment'
        );
      END IF;
    END IF;

    UPDATE public.unmapped_items
    SET resolved_at = now(), resolved_sku_id = v_sku_id
    WHERE id = v_item.id;
    v_resolved := v_resolved + 1;
  END LOOP;

  FOREACH v_shipment_id IN ARRAY v_shipments_to_consume
  LOOP
    PERFORM public.consume_shipment_stock(p_tenant_id, v_shipment_id);
  END LOOP;

  RETURN QUERY
  SELECT
    v_resolved,
    (SELECT COUNT(*)::integer
     FROM public.unmapped_items ui
     WHERE ui.tenant_id = p_tenant_id AND ui.resolved_at IS NULL);
END;
$$;

-- Legacy overload stays bounded instead of scanning the entire tenant.
CREATE OR REPLACE FUNCTION public.remap_unmapped_items(p_tenant_id uuid)
RETURNS TABLE(resolved integer, still_unmapped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.remap_unmapped_items(p_tenant_id, 2000);
END;
$$;

REVOKE ALL ON FUNCTION public.remap_unmapped_items(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remap_unmapped_items(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remap_unmapped_items(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.remap_unmapped_items(uuid, integer) TO service_role;
