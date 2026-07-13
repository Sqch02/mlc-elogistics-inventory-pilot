-- Reverse stock caused by obsolete UUID Sendcloud shipments, then delete those
-- shipments atomically. The row lock makes retries/concurrent cron runs
-- idempotent: only the transaction that still owns existing shipment rows can
-- calculate and apply a reversal.

CREATE FUNCTION public.reverse_duplicate_shipment_stock(
  p_tenant_id uuid,
  p_shipment_ids uuid[]
)
RETURNS TABLE(shipments_deleted integer, skus_reversed integer, units_reversed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_delta record;
  v_shipments_deleted integer := 0;
  v_skus_reversed integer := 0;
  v_units_reversed integer := 0;
BEGIN
  IF COALESCE(cardinality(p_shipment_ids), 0) = 0 THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- Serialize concurrent attempts before reading stock_movements. Rows that a
  -- previous transaction deleted disappear after the lock wait, preventing a
  -- second reversal.
  PERFORM id
  FROM public.shipments
  WHERE tenant_id = p_tenant_id
    AND id = ANY(p_shipment_ids)
  FOR UPDATE;

  FOR v_delta IN
    SELECT
      sm.sku_id,
      (-SUM(sm.adjustment))::integer AS qty_to_restore
    FROM public.stock_movements sm
    JOIN public.shipments s
      ON s.id = sm.reference_id
     AND s.tenant_id = p_tenant_id
    WHERE sm.tenant_id = p_tenant_id
      AND sm.movement_type = 'shipment'
      AND s.id = ANY(p_shipment_ids)
    GROUP BY sm.sku_id
    HAVING SUM(sm.adjustment) < 0
  LOOP
    IF v_delta.qty_to_restore > 0 THEN
      PERFORM public.apply_stock_delta(
        p_tenant_id,
        v_delta.sku_id,
        v_delta.qty_to_restore,
        'Auto-reverse: doublon UUID/numeric Sendcloud, UUID supprimee',
        NULL,
        'manual',
        NULL,
        'manual'
      );
      v_skus_reversed := v_skus_reversed + 1;
      v_units_reversed := v_units_reversed + v_delta.qty_to_restore;
    END IF;
  END LOOP;

  DELETE FROM public.shipments
  WHERE tenant_id = p_tenant_id
    AND id = ANY(p_shipment_ids);
  GET DIAGNOSTICS v_shipments_deleted = ROW_COUNT;

  RETURN QUERY
  SELECT v_shipments_deleted, v_skus_reversed, v_units_reversed;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reverse_duplicate_shipment_stock(uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_duplicate_shipment_stock(uuid, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_duplicate_shipment_stock(uuid, uuid[]) TO service_role;
