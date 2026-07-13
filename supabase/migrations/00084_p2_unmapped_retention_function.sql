-- Fonction de retention unmapped_items : supprime UNIQUEMENT les lignes RESOLUES
-- (resolved_at IS NOT NULL) plus vieilles que p_days (audit pur, shipment_item
-- deja insere -> aucun impact stock/analytics). Cree la fonction seulement.
CREATE OR REPLACE FUNCTION public.cleanup_resolved_unmapped_items(p_days integer DEFAULT 90)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  IF p_days IS NULL OR p_days < 1 THEN
    RAISE EXCEPTION 'p_days doit etre >= 1 (recu: %)', p_days;
  END IF;
  WITH del AS (
    DELETE FROM public.unmapped_items
    WHERE resolved_at IS NOT NULL AND resolved_at < now() - make_interval(days => p_days)
    RETURNING 1
  ) SELECT count(*)::integer INTO v_deleted FROM del;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_resolved_unmapped_items(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_resolved_unmapped_items(integer) TO service_role;
