-- Programmer la detection des conversions de devise defaites, une fois par heure.
--
-- Ce passage ne reecrit RIEN chez Sendcloud. Il relit les conversions des
-- 14 derniers jours et, quand les montants sont revenus en devise etrangere
-- ET que la commande est encore ouverte, il remet la tache en file manuelle
-- avec sa raison. Une commande deja partie est seulement horodatee : la
-- conversion avait tenu le temps de faire l'etiquette.
--
-- CADENCE ET PLAFOND
-- Une fois par heure, 40 commandes au plus. Chaque commande coute une
-- recherche chez Sendcloud, et la garde des 6 heures empeche de relire deux
-- fois la meme dans la journee. Le creneau :30 est libre.
--
-- Sans ce passage, l'exploitant decouvre ces commandes une par une au moment
-- de faire l'etiquette, sans que rien ne les annonce.

CREATE OR REPLACE FUNCTION public.trigger_currency_regression_scan()
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
    url := 'https://mlc-elogistics-inventory-pilot.onrender.com/api/sync/sendcloud/reconcile?mode=devises&dry_run=false&limit=40',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 240000
  ) INTO v_id;
  RETURN v_id;
END $function$;

REVOKE ALL ON FUNCTION public.trigger_currency_regression_scan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_currency_regression_scan() TO service_role;

SELECT cron.schedule(
  'auto-fix-currency-regression-scan',
  '30 * * * *',
  $$SELECT public.trigger_currency_regression_scan()$$
);
