-- Consume-at-ship bounded sweeper and reviewed one-time recalibration.
-- FILE ONLY until the client rollout is explicitly approved.

-- Supports the non-consumable/consumed half of the sweeper. Schedule this
-- migration outside peak hours: shipments is a large production table.
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_consumed_recent
  ON public.shipments (tenant_id, stock_consumed_at DESC, id)
  WHERE stock_consumed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reconcile_tenant_stock(
  p_tenant_id uuid,
  p_limit integer DEFAULT 200
) RETURNS TABLE(consumed_count integer, reversed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(200, GREATEST(1, COALESCE(p_limit, 200)));
  v_examined integer := 0;
  v_consumed integer := 0;
  v_reversed integer := 0;
  v_changed boolean;
  v_shipment record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  -- Restore wrong consumption first. The partial non-NULL index keeps this
  -- bounded lookup off the 738 MB full shipments heap in normal operation.
  FOR v_shipment IN
    SELECT s.id
    FROM public.shipments s
    WHERE s.tenant_id = p_tenant_id
      AND s.stock_consumed_at IS NOT NULL
      AND NOT public.is_consumable_shipment(s.status_id, s.status_message, s.is_return)
    ORDER BY s.stock_consumed_at DESC, s.id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT r.restocked INTO v_changed
    FROM public.restock_shipment_stock(
      p_tenant_id,
      v_shipment.id,
      'Réconciliation consume-at-ship'
    ) r;
    IF COALESCE(v_changed, false) THEN v_reversed := v_reversed + 1; END IF;
    v_examined := v_examined + 1;
  END LOOP;

  -- Spend only the remaining shared budget on missed consumptions.
  IF v_examined < v_limit THEN
    FOR v_shipment IN
      SELECT s.id
      FROM public.shipments s
      WHERE s.tenant_id = p_tenant_id
        AND s.stock_consumed_at IS NULL
        AND public.is_consumable_shipment(s.status_id, s.status_message, s.is_return)
        AND EXISTS (
          SELECT 1
          FROM public.shipment_items si
          WHERE si.tenant_id = p_tenant_id AND si.shipment_id = s.id
        )
      ORDER BY s.shipped_at DESC NULLS LAST, s.id
      LIMIT (v_limit - v_examined)
      FOR UPDATE SKIP LOCKED
    LOOP
      SELECT c.consumed INTO v_changed
      FROM public.consume_shipment_stock(p_tenant_id, v_shipment.id) c;
      IF COALESCE(v_changed, false) THEN v_consumed := v_consumed + 1; END IF;
      v_examined := v_examined + 1;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_consumed, v_reversed;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_tenant_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_tenant_stock(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.recalibrate_consumed_not_shipped_report(
  p_tenant_id uuid
) RETURNS TABLE(sku_id uuid, units_to_restore integer, shipment_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    sm.sku_id,
    (-SUM(sm.adjustment))::integer AS units_to_restore,
    COUNT(DISTINCT s.id)::integer AS shipment_count
  FROM public.stock_movements sm
  JOIN public.shipments s
    ON s.id = sm.reference_id
   AND s.tenant_id = p_tenant_id
  WHERE sm.tenant_id = p_tenant_id
    AND sm.reference_type = 'shipment'
    AND sm.movement_type = 'shipment'
    AND s.stock_consumed_at IS NOT NULL
    AND NOT public.is_consumable_shipment(s.status_id, s.status_message, s.is_return)
  GROUP BY sm.sku_id
  HAVING -SUM(sm.adjustment) > 0
  ORDER BY 2 DESC, sm.sku_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalibrate_consumed_not_shipped_report(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalibrate_consumed_not_shipped_report(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recalibrate_consumed_not_shipped_apply(
  p_tenant_id uuid,
  p_expected_total integer
) RETURNS TABLE(skus_restored integer, units_restored integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_ids uuid[] := ARRAY[]::uuid[];
  v_expected integer := 0;
  v_skus integer := 0;
  v_units integer := 0;
  v_delta record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  -- Freeze exactly the report target set for the duration of this transaction.
  PERFORM s.id
  FROM public.shipments s
  WHERE s.tenant_id = p_tenant_id
    AND s.stock_consumed_at IS NOT NULL
    AND NOT public.is_consumable_shipment(s.status_id, s.status_message, s.is_return)
  ORDER BY s.id
  FOR UPDATE;

  SELECT COALESCE(array_agg(s.id ORDER BY s.id), ARRAY[]::uuid[])
    INTO v_target_ids
  FROM public.shipments s
  WHERE s.tenant_id = p_tenant_id
    AND s.stock_consumed_at IS NOT NULL
    AND NOT public.is_consumable_shipment(s.status_id, s.status_message, s.is_return);

  SELECT COALESCE(SUM(delta.units_to_restore), 0)::integer
    INTO v_expected
  FROM (
    SELECT (-SUM(sm.adjustment))::integer AS units_to_restore
    FROM public.stock_movements sm
    WHERE sm.tenant_id = p_tenant_id
      AND sm.reference_type = 'shipment'
      AND sm.movement_type = 'shipment'
      AND sm.reference_id = ANY(v_target_ids)
    GROUP BY sm.sku_id
    HAVING -SUM(sm.adjustment) > 0
  ) delta;

  IF p_expected_total IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'recalibration total changed: expected %, current %',
      p_expected_total, v_expected USING ERRCODE = '22000';
  END IF;

  FOR v_delta IN
    SELECT sm.sku_id, (-SUM(sm.adjustment))::integer AS units_to_restore
    FROM public.stock_movements sm
    WHERE sm.tenant_id = p_tenant_id
      AND sm.reference_type = 'shipment'
      AND sm.movement_type = 'shipment'
      AND sm.reference_id = ANY(v_target_ids)
    GROUP BY sm.sku_id
    HAVING -SUM(sm.adjustment) > 0
    ORDER BY sm.sku_id
  LOOP
    PERFORM public.apply_stock_delta(
      p_tenant_id,
      v_delta.sku_id,
      v_delta.units_to_restore,
      'Recalibration consume-at-ship',
      NULL::uuid,
      'recalibration',
      auth.uid(),
      'manual'
    );
    v_skus := v_skus + 1;
    v_units := v_units + v_delta.units_to_restore;
  END LOOP;

  UPDATE public.shipments
  SET stock_consumed_at = NULL
  WHERE tenant_id = p_tenant_id AND id = ANY(v_target_ids);

  RETURN QUERY SELECT v_skus, v_units;
END;
$$;

REVOKE ALL ON FUNCTION public.recalibrate_consumed_not_shipped_apply(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalibrate_consumed_not_shipped_apply(uuid, integer) TO service_role;
