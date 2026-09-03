-- Programmer la fermeture des taches manuelles dont la commande est partie,
-- une fois par heure.
--
-- La migration 00130 a rendu cette fermeture POSSIBLE ; elle a ete lancee en
-- simulation puis en reel le 03/09 au soir. Le cout par passage : au plus
-- 100 lectures de commande par client, sur les seules taches manuelles de
-- plus de 24 h. En regime courant, quelques lectures par heure.
--
-- POURQUOI 24 H
-- Une tache en attente manuelle de moins d'un jour est du travail que
-- l'exploitant n'a pas encore vu : la fermer trop tot, c'est lui cacher une
-- correction a faire. Passe un jour, si la commande est partie, c'est qu'il
-- l'a traitee lui-meme ; la tache ne decrit plus rien.
--
-- Le creneau :15 est libre des autres taches planifiees.

CREATE OR REPLACE FUNCTION public.trigger_close_fulfilled_orders()
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
    url := 'https://mlc-elogistics-inventory-pilot.onrender.com/api/sync/sendcloud/reconcile?mode=commandes&dry_run=false&limit=100',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 240000
  ) INTO v_id;
  RETURN v_id;
END $function$;

REVOKE ALL ON FUNCTION public.trigger_close_fulfilled_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_close_fulfilled_orders() TO service_role;

SELECT cron.schedule(
  'auto-fix-close-fulfilled-orders',
  '15 * * * *',
  $$SELECT public.trigger_close_fulfilled_orders()$$
);
