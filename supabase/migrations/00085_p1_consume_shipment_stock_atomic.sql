-- P1 Stock: consommation par expedition ATOMIQUE (corrige l'echec partiel avale).
-- CAS claim sur stock_consumed_at + tous les apply_stock_delta dans UNE transaction
-- (tout-ou-rien). Un echec par-item rollback tout -> stock_consumed_at reste NULL
-- et la commande peut etre re-drivee. consume.ts appelle cette RPC et throw sur erreur.
CREATE OR REPLACE FUNCTION public.consume_shipment_stock(
  p_tenant_id uuid,
  p_shipment_id uuid
) RETURNS TABLE(consumed boolean, item_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_claimed integer;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;
  UPDATE shipments SET stock_consumed_at = now()
  WHERE id = p_shipment_id AND tenant_id = p_tenant_id AND stock_consumed_at IS NULL;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN RETURN QUERY SELECT false, 0; RETURN; END IF;
  FOR v_item IN
    SELECT si.sku_id, si.qty FROM shipment_items si
    WHERE si.tenant_id = p_tenant_id AND si.shipment_id = p_shipment_id
  LOOP
    PERFORM * FROM public.apply_stock_delta(
      p_tenant_id, v_item.sku_id, -v_item.qty,
      'Expédition', p_shipment_id, 'shipment', NULL::uuid, 'shipment');
    v_count := v_count + 1;
  END LOOP;
  RETURN QUERY SELECT true, v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_shipment_stock(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_shipment_stock(uuid, uuid) TO service_role;
