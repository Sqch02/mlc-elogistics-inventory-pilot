-- Retention sync_runs : supprime l'historique > p_days en PRESERVANT la derniere
-- execution reussie/partielle porteuse d'un cursor par (tenant_id, source)
-- (protege get_last_sync_cursor). Creation seule; invocation via service_role.
CREATE OR REPLACE FUNCTION public.cleanup_old_sync_runs(p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  IF p_days IS NULL OR p_days < 1 THEN
    RAISE EXCEPTION 'p_days doit etre >= 1 (recu: %)', p_days;
  END IF;
  WITH keep AS (
    SELECT DISTINCT ON (tenant_id, source) id FROM public.sync_runs
    WHERE cursor IS NOT NULL AND status IN ('success', 'partial')
    ORDER BY tenant_id, source, ended_at DESC NULLS LAST
  ), del AS (
    DELETE FROM public.sync_runs
    WHERE started_at < now() - make_interval(days => p_days) AND id NOT IN (SELECT id FROM keep)
    RETURNING 1
  ) SELECT count(*)::integer INTO v_deleted FROM del;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_old_sync_runs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_sync_runs(integer) TO service_role;
