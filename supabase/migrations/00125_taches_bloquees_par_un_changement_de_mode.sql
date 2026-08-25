-- Refermer les taches rendues inatteignables par un changement de mode.
--
-- LE BLOCAGE
-- `claim_auto_fix_jobs` exige que le mode de la TACHE et celui du CLIENT
-- coincident :
--     AND j.mode = p_mode
--     AND ts.auto_fix_mode = p_mode
--
-- Quand un client passe de `simulated` a `live`, les taches deja en file
-- gardent l'ancien mode. Le travailleur simule ne les prend plus -- le client
-- n'est plus en simule -- et le travailleur live non plus, puisque la tache
-- l'est encore. Elles ne sont ni en echec, ni en attente manuelle : elles
-- restent en file, indefiniment, et ne sont comptees nulle part.
--
-- MESURE DU 24/08
-- Quatre taches attendaient ainsi depuis le 28 juillet, date du passage en
-- live du client concerne. Un mois sans que rien ne le signale.
--
-- POURQUOI LES FERMER NE PERD RIEN
-- La cle d'operation inclut le mode : le probleme a donc ete redetecte en
-- mode live des le lendemain. Verification faite commande par commande, les
-- quatre portent des taches `live` deja refermees, et les quatre colis sont
-- livres depuis un mois. Ce sont des residus de simulation, pas du travail.
--
-- LE DELAI DE 24 HEURES
-- Il protege le basculement lui-meme : pendant qu'un client change de mode, on
-- ne veut pas refermer des taches en cours de traitement. Au-dela d'une
-- journee, l'ecart de mode n'est plus une transition mais un blocage.
--
-- C'est la septieme variante du meme defaut trouvee aujourd'hui : un etat sans
-- sortie. La question a se poser devant chaque etat non terminal reste la
-- meme -- par quel chemin en sort-on, et qui le declenche ?

CREATE OR REPLACE FUNCTION public.close_mode_stranded_auto_fix_jobs(p_limit integer DEFAULT 500)
RETURNS TABLE(closed integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_closed integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 5000 THEN
    p_limit := 500;
  END IF;

  WITH candidates AS (
    SELECT j.id, j.mode AS mode_tache, ts.auto_fix_mode AS mode_client
    FROM public.auto_fix_jobs j
    JOIN public.tenant_settings ts ON ts.tenant_id = j.tenant_id
    WHERE j.state IN ('queued', 'retry_wait')
      AND j.mode <> ts.auto_fix_mode
      AND j.updated_at < now() - interval '24 hours'
    ORDER BY j.created_at
    LIMIT p_limit
    FOR UPDATE OF j SKIP LOCKED
  ), updated AS (
    UPDATE public.auto_fix_jobs j
    SET state = 'obsolete',
        cancelled_at = now(),
        updated_at = now(),
        closure_json = jsonb_build_object(
          'reason', 'mode_changed_job_unreachable',
          'detail', format('tache en mode %s, client passe en mode %s : plus aucun travailleur ne peut la reclamer',
                           c.mode_tache, c.mode_client),
          'observed_by', 'close_mode_stranded_auto_fix_jobs',
          'closed_at', now()
        )
    FROM candidates c
    WHERE j.id = c.id
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_closed FROM updated;

  RETURN QUERY
  SELECT v_closed,
         (SELECT count(*)::integer FROM public.auto_fix_jobs
          WHERE state IN ('queued', 'retry_wait'));
END;
$function$;

REVOKE ALL ON FUNCTION public.close_mode_stranded_auto_fix_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_mode_stranded_auto_fix_jobs(integer) TO service_role;

SELECT cron.schedule(
  'auto-fix-close-mode-stranded',
  '55 * * * *',
  $$SELECT public.close_mode_stranded_auto_fix_jobs(500)$$
);
