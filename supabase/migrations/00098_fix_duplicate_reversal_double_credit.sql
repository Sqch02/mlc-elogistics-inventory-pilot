-- P0 (24/07/2026) : reverse_duplicate_shipment_stock recreditait du stock deja rendu.
--
-- Le chemin DEDUPE 2/2 du cron appelle cette fonction quand un colis numerique
-- remplace son jumeau UUID. Elle calculait le montant a rendre avec
-- (-SUM(adjustment)) en ne filtrant QUE movement_type = 'shipment'. Elle etait
-- donc aveugle aux mouvements 'restock' ecrits par restock_shipment_stock
-- (annulation, sweeper, recalibration consume-at-ship) et ne consultait jamais
-- shipments.stock_consumed_at. Un colis dont le stock avait deja ete rendu
-- etait donc recredite une seconde fois.
--
-- Exposition constatee apres la recalibration du 24/07 17:00 (1882 unites
-- rendues sur FLORNA) : des colis UUID recalibres attendaient leur jumeau
-- numerique. Aucun auto-reverse n'avait encore tire depuis (dernier a 15:26),
-- donc rien ne s'etait materialise, mais ce chemin avait tire 84 fois dans les
-- 24 h precedentes.
--
-- Correctif, aligne sur l'arithmetique de restock_shipment_stock (00096) :
--   1. ne rendre du stock que pour un colis encore marque consomme
--      (stock_consumed_at IS NOT NULL) -- garde porteuse : une seconde
--      reversion devient strictement no-op ;
--   2. calculer l'effet REEL du ledger, SUM(qty_before - qty_after), en
--      incluant les mouvements 'restock', au lieu du delta DEMANDE. Le plancher
--      GREATEST(0, ...) de apply_stock_delta rend ces deux valeurs differentes
--      des qu'une consommation a touche zero.
-- Le reste (verrou FOR UPDATE, suppression du doublon, valeurs de retour) est
-- inchange : un doublon dont le stock a deja ete rendu est toujours supprime,
-- simplement sans nouveau credit.
--
-- Le fallback TypeScript src/lib/stock/reverse-duplicates.ts portait le meme
-- defaut et a ete corrige a l'identique.

CREATE OR REPLACE FUNCTION public.reverse_duplicate_shipment_stock(
  p_tenant_id uuid,
  p_shipment_ids uuid[]
) RETURNS TABLE(shipments_deleted integer, skus_reversed integer, units_reversed integer)
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

  PERFORM id
  FROM public.shipments
  WHERE tenant_id = p_tenant_id
    AND id = ANY(p_shipment_ids)
  FOR UPDATE;

  FOR v_delta IN
    SELECT
      sm.sku_id,
      GREATEST(0, SUM(sm.qty_before - sm.qty_after))::integer AS qty_to_restore
    FROM public.stock_movements sm
    JOIN public.shipments s
      ON s.id = sm.reference_id
     AND s.tenant_id = p_tenant_id
    WHERE sm.tenant_id = p_tenant_id
      AND sm.reference_type = 'shipment'
      AND sm.movement_type IN ('shipment', 'restock')
      AND s.id = ANY(p_shipment_ids)
      -- Un colis deja rembourse (annulation, sweeper, recalibration) a un
      -- marqueur NULL : on ne lui rend rien une seconde fois.
      AND s.stock_consumed_at IS NOT NULL
    GROUP BY sm.sku_id
    HAVING SUM(sm.qty_before - sm.qty_after) > 0
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

  RETURN QUERY SELECT v_shipments_deleted, v_skus_reversed, v_units_reversed;
END;
$function$;

REVOKE ALL ON FUNCTION public.reverse_duplicate_shipment_stock(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_duplicate_shipment_stock(uuid, uuid[]) TO service_role;
