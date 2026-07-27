-- Declenchement periodique du worker auto-fix.
--
-- POURQUOI CETTE MIGRATION EXISTE
-- Le systeme fonctionne en deux temps. La synchronisation (toutes les 5 min)
-- REPERE les commandes en erreur, ou celles qui vont l'etre, et les met en
-- file. Rien ne LISAIT cette file : elle se remplissait et personne ne la
-- traitait. Les seules executions du 27/07 ont ete declenchees a la main.
--
-- On reprend le mecanisme deja eprouve pour le rafraichissement des vues
-- analytiques : pg_cron appelle, pg_net porte l'appel HTTP. Cela evite une
-- dependance externe supplementaire et garde la planification aupres du reste
-- du systeme.
--
-- CE QUE CE TRAVAIL NE FAIT PAS. Il n'ecrit rien chez Sendcloud. L'endpoint
-- appele ne connait que le mode simulation ; l'ecriture reelle a ses propres
-- verrous, tous fermes. Passer ce travail a l'ecriture demandera une decision
-- explicite, pas une modification de planning.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- Le jeton d'appel
-- ---------------------------------------------------------------------------
-- Il vit dans le coffre plutot que dans la definition du travail : la table
-- cron.job est lisible par tout compte administrateur, et un secret recopie
-- dans une commande finit toujours par trainer dans un export ou un journal.
--
-- ATTENTION EN CAS DE ROTATION : ce jeton doit rester identique a la variable
-- CRON_SECRET definie sur Render. Changer l'un sans l'autre casse l'appel en
-- silence — cote base on ne verra qu'un HTTP 401 dans net._http_response.

DO $$
DECLARE
  v_existant uuid;
BEGIN
  SELECT id INTO v_existant FROM vault.secrets WHERE name = 'auto_fix_worker_bearer';
  IF v_existant IS NULL THEN
    PERFORM vault.create_secret(
      'mlc-cron-2024',
      'auto_fix_worker_bearer',
      'Jeton d''appel du worker auto-fix. Doit rester egal a CRON_SECRET sur Render.'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- L'appel
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_auto_fix_worker()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'auto_fix_worker_bearer';

  -- Sans jeton, ne rien appeler : un appel non authentifie ne ferait
  -- qu'accumuler des 401 sans que personne ne s'en apercoive.
  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RAISE WARNING 'auto_fix_worker_bearer absent du coffre : appel abandonne';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://mlc-elogistics-inventory-pilot.onrender.com/api/auto-fix/run',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    -- L'appel dure 1,5 a 2,5 s en pratique, et le worker se borne lui-meme a
    -- 20 s. On laisse une marge confortable plutot que de couper une execution
    -- utile.
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_auto_fix_worker() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_auto_fix_worker() TO postgres;

-- ---------------------------------------------------------------------------
-- La planification
-- ---------------------------------------------------------------------------
-- Toutes les 15 minutes. Chaque appel traite jusqu'a auto_fix_max_candidates
-- commandes par client (5 aujourd'hui), soit largement de quoi absorber la
-- vingtaine d'erreurs quotidiennes et rattraper le stock en cours.
--
-- Decale de 3 minutes par rapport aux minutes rondes : la synchronisation
-- tourne sur celles-ci, et il n'y a aucune raison de les faire coincider.

SELECT cron.schedule(
  'auto-fix-worker',
  '3,18,33,48 * * * *',
  $$SELECT public.trigger_auto_fix_worker();$$
);

-- ---------------------------------------------------------------------------
-- De quoi voir que ca marche
-- ---------------------------------------------------------------------------
-- Un appel HTTP lance depuis la base echoue en silence : ni exception, ni
-- journal applicatif. Cette vue rend le resultat consultable, sinon la panne
-- ne se decouvre qu'en constatant que la file ne se vide plus.

CREATE OR REPLACE VIEW public.v_auto_fix_worker_calls AS
SELECT
  r.id,
  r.created                                   AS appele_a,
  r.status_code                               AS code_http,
  (r.status_code BETWEEN 200 AND 299)         AS succes,
  left(r.content, 400)                        AS reponse,
  r.error_msg                                 AS erreur
FROM net._http_response r
ORDER BY r.created DESC;

REVOKE ALL ON public.v_auto_fix_worker_calls FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_auto_fix_worker_calls TO service_role;

COMMENT ON FUNCTION public.trigger_auto_fix_worker() IS
  'Appelle le worker auto-fix (simulation seule). Jeton lu dans le coffre, doit rester egal a CRON_SECRET sur Render.';
