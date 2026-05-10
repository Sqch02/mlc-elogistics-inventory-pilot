-- Migration 00050: Fix bugs critiques stock + refresh
--
-- Bug 1 : refresh_all_analytics_views() plantait sur mv_shopify_anomaly_items
-- (REFRESH CONCURRENTLY incompatible avec son index COALESCE + refresh non-concurrent
-- timeout sur le scan complet de raw_json). Resultat : aucune des 4 mat views ne se
-- rafraichissait depuis le 20/04, toutes les pages affichaient l'etat fige.
--
-- Bug 2 : remap_unmapped_items inserait shipment_items mais ne decrement pas
-- stock_snapshots. Pour les SKUs crees apres la sync initiale (ARTICU, ENERG,
-- DIGEST, BAGUEM chez Florna), le snapshot restait fige a la valeur du restock
-- initial, jamais decremente par les ventes posterieures.

-- Fix 1 : retirer mv_shopify_anomaly_items du refresh consolide.
-- Elle reste rafraichissable a la demande via refresh_shopify_anomaly_items().
CREATE OR REPLACE FUNCTION refresh_all_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_physical_shipment_items;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sku_metrics;
  -- mv_shopify_anomaly_items volontairement exclue : refresh trop long pour le cron.
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_all_analytics_views TO service_role;

-- Fix 2 : remap_unmapped_items decrement stock_snapshots a chaque resolution.
CREATE OR REPLACE FUNCTION remap_unmapped_items(p_tenant_id uuid)
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
  FOR v_item IN
    SELECT * FROM unmapped_items
    WHERE tenant_id = p_tenant_id AND resolved_at IS NULL
  LOOP
    v_sku_id := map_shipment_item(
      p_tenant_id,
      v_item.raw_sku,
      v_item.raw_description,
      v_item.raw_variant_id
    );

    IF v_sku_id IS NOT NULL THEN
      INSERT INTO shipment_items (tenant_id, shipment_id, sku_id, qty)
      VALUES (v_item.tenant_id, v_item.shipment_id, v_sku_id, v_item.qty)
      ON CONFLICT (shipment_id, sku_id) DO UPDATE
        SET qty = shipment_items.qty + EXCLUDED.qty;

      -- Decrement stock_snapshots du SKU mappe (creation si snapshot inexistant).
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
