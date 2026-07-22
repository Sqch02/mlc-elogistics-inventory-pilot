-- Consume-at-ship bounded sweeper and reviewed one-time recalibration.
-- FILE ONLY until the client rollout is explicitly approved.

-- Historical reversal is opt-in tenant by tenant only after the report,
-- backup and recalibration have been signed. Missing shipped consumption is
-- still reconciled globally by the second half of the sweeper.
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS consume_at_ship_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenant_settings.consume_at_ship_enabled IS
  'Allows historical non-consumable stock reversal after tenant rollout approval';

-- This statement MUST be run outside a transaction and outside peak hours.
-- Its predicate exactly matches the first sweeper query, so PostgreSQL can stop
-- after 200 index candidates instead of filtering the tenant consumed heap.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_tenant_non_consumable_consumed
  ON public.shipments (tenant_id, stock_consumed_at DESC, id)
  INCLUDE (status_id, status_message, is_return)
  WHERE stock_consumed_at IS NOT NULL
    AND NOT public.is_consumable_shipment(status_id, status_message, is_return);

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
  v_historical_reversal_enabled boolean := false;
  v_shipment record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(ts.consume_at_ship_enabled, false)
    INTO v_historical_reversal_enabled
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = p_tenant_id;

  -- Restore historical wrong consumption only after this tenant's reviewed
  -- rollout. The predicate-matched partial index makes LIMIT 200 a true bounded
  -- candidate lookup; it does not restart by filtering the consumed heap.
  IF v_historical_reversal_enabled THEN
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
  END IF;

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
) RETURNS TABLE(
  sku_id uuid,
  requested_units_to_restore integer,
  effective_units_to_restore integer,
  shipment_count integer
)
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
  WITH shipment_sku_deltas AS (
    SELECT
      s.id AS shipment_id,
      sm.sku_id,
      GREATEST(0, -SUM(sm.adjustment))::integer AS requested_units_to_restore,
      GREATEST(0, SUM(sm.qty_before - sm.qty_after))::integer
        AS effective_units_to_restore
    FROM public.shipments s
    JOIN public.stock_movements sm
      ON sm.tenant_id = p_tenant_id
     AND sm.reference_id = s.id
     AND sm.reference_type = 'shipment'
     AND sm.movement_type IN ('shipment', 'restock')
    WHERE s.tenant_id = p_tenant_id
      AND s.stock_consumed_at IS NOT NULL
      AND NOT public.is_consumable_shipment(s.status_id, s.status_message, s.is_return)
    GROUP BY s.id, sm.sku_id
  )
  SELECT
    d.sku_id,
    SUM(d.requested_units_to_restore)::integer,
    SUM(d.effective_units_to_restore)::integer,
    COUNT(DISTINCT d.shipment_id)::integer
  FROM shipment_sku_deltas d
  WHERE d.requested_units_to_restore > 0 OR d.effective_units_to_restore > 0
  GROUP BY d.sku_id
  ORDER BY SUM(d.effective_units_to_restore) DESC, d.sku_id;
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
  v_restocked boolean;
  v_shipment_id uuid;
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

  SELECT COALESCE(SUM(delta.effective_units_to_restore), 0)::integer
    INTO v_expected
  FROM (
    SELECT
      sm.reference_id,
      sm.sku_id,
      GREATEST(0, SUM(sm.qty_before - sm.qty_after))::integer
        AS effective_units_to_restore
    FROM public.stock_movements sm
    WHERE sm.tenant_id = p_tenant_id
      AND sm.reference_type = 'shipment'
      AND sm.movement_type IN ('shipment', 'restock')
      AND sm.reference_id = ANY(v_target_ids)
    GROUP BY sm.reference_id, sm.sku_id
  ) delta;

  IF p_expected_total IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'recalibration total changed: expected %, current %',
      p_expected_total, v_expected USING ERRCODE = '22000';
  END IF;

  SELECT COUNT(*)::integer
    INTO v_skus
  FROM (
    SELECT DISTINCT shipment_effects.sku_id
    FROM (
      SELECT sm.reference_id, sm.sku_id
      FROM public.stock_movements sm
      WHERE sm.tenant_id = p_tenant_id
        AND sm.reference_type = 'shipment'
        AND sm.movement_type IN ('shipment', 'restock')
        AND sm.reference_id = ANY(v_target_ids)
      GROUP BY sm.reference_id, sm.sku_id
      HAVING SUM(sm.qty_before - sm.qty_after) > 0
    ) shipment_effects
  ) affected_skus;

  -- Reuse the same per-shipment atomic reversal as cancellations and the
  -- sweeper. This writes a referenced `restock` movement, neutralizes the
  -- original ledger and clears the marker in the same transaction.
  FOREACH v_shipment_id IN ARRAY v_target_ids
  LOOP
    SELECT r.restocked INTO v_restocked
    FROM public.restock_shipment_stock(
      p_tenant_id,
      v_shipment_id,
      'Recalibration consume-at-ship'
    ) r;

    IF NOT COALESCE(v_restocked, false) THEN
      RAISE EXCEPTION 'recalibration lost shipment claim: %', v_shipment_id
        USING ERRCODE = '40001';
    END IF;
  END LOOP;

  v_units := v_expected;

  RETURN QUERY SELECT v_skus, v_units;
END;
$$;

REVOKE ALL ON FUNCTION public.recalibrate_consumed_not_shipped_apply(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalibrate_consumed_not_shipped_apply(uuid, integer) TO service_role;
