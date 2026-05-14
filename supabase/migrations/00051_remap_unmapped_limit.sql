-- Migration 00051 : limite le remap retroactif au moment de la creation d'un SKU
--
-- Bug : un tenant avec un gros backlog d'unmapped_items (Anteos : >670k entrees)
-- faisait timeout l'INSERT sku car le trigger remap_on_sku_insert appelait
-- remap_unmapped_items qui itere sur TOUS les unmapped pour ce tenant. Resultat,
-- "Erreur serveur" cote app quand on tentait de creer un produit.
--
-- Fix : remap_unmapped_items accepte un parametre p_limit, et le trigger ne
-- traite plus que 2000 items par INSERT/UPDATE SKU. Les unmapped restants seront
-- repris par un appel manuel ou un cron dedie.

CREATE OR REPLACE FUNCTION remap_unmapped_items(p_tenant_id uuid, p_limit integer DEFAULT NULL)
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
    ORDER BY created_at DESC
    LIMIT COALESCE(p_limit, 2147483647)
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

CREATE OR REPLACE FUNCTION trigger_remap_on_sku_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM remap_unmapped_items(NEW.tenant_id, 2000);
  RETURN NEW;
END;
$function$;
