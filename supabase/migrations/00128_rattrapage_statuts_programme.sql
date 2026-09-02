-- Programmer le rattrapage des statuts perimes, une fois par heure.
--
-- Le 02/09, la migration 00127 a rendu ce rattrapage POSSIBLE mais l'a laisse
-- au declenchement manuel, le temps d'observer son cout. Il a ete lance en
-- simulation puis en reel le meme soir : le cout est celui de 200 lectures de
-- colis par passage, sans commune mesure avec l'incident de saturation du
-- 13/07, qui tenait a la lecture de milliers de lignes par la synchro
-- principale.
--
-- Le laisser manuel reviendrait a remplacer le travail manuel de Quentin par
-- le mien : ce n'est pas une correction, c'est un deplacement.
--
-- CADENCE ET PLAFOND
-- Une fois par heure, 200 colis au plus. L'arriere historique — plusieurs
-- milliers de colis figes depuis des incidents passes — se resorbe en deux
-- jours environ ; ensuite il ne reste que la douzaine mensuelle du regime
-- courant, absorbee en un seul passage.
--
-- Le creneau :45 est libre des autres taches planifiees.

CREATE OR REPLACE FUNCTION public.trigger_stale_status_reconcile()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_secret text; v_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
  WHERE name = 'auto_fix_worker_bearer';
  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RAISE WARNING 'jeton absent du coffre : appel abandonne';
    RETURN NULL;
  END IF;
  SELECT net.http_get(
    url := 'https://mlc-elogistics-inventory-pilot.onrender.com/api/sync/sendcloud/reconcile?mode=statuts&dry_run=false&limit=200',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 240000
  ) INTO v_id;
  RETURN v_id;
END $function$;

REVOKE ALL ON FUNCTION public.trigger_stale_status_reconcile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_stale_status_reconcile() TO service_role;

SELECT cron.schedule(
  'sync-reconcile-stale-statuses',
  '45 * * * *',
  $$SELECT public.trigger_stale_status_reconcile()$$
);
