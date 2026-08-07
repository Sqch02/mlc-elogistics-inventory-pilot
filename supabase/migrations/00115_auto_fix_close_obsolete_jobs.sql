-- Refermer les taches manuelles devenues sans objet.
--
-- CONSTAT (mesure du 07/08 sur la production)
-- Le tableau annoncait 401 corrections manuelles en attente. En croisant avec
-- l'etat reel des colis : 196 etaient DEJA LIVRES, 18 en transit ou retournes,
-- et 44 seulement restaient corrigeables. L'alerte « corrections manuelles en
-- hausse » se declenchait toutes les 6 h sur cette pile morte.
--
-- POURQUOI CETTE PILE EXISTE
-- Ce n'est pas un defaut de detection : la tache est creee quand le colis est
-- encore corrigeable ("Ready to send"), puis le colis part, arrive, est livre —
-- et personne ne referme la tache. La file n'a jamais eu de sortie pour ce cas.
--
-- CE QUE CA COUTE
-- Un tableau qui annonce dix fois plus de travail qu'il n'y en a finit ignore,
-- et le jour ou il affiche une vraie urgence, plus personne ne la voit.
--
-- LA REGLE EST CELLE DE LA DETECTION, PAS UNE NOUVELLE
-- src/lib/auto-fix/detect.ts refuse deja de creer une tache pour un colis
-- annonce au transporteur, sauf 1000 (pret a envoyer) et 1002 (echec
-- d'annonce), les deux seuls etats ou le colis reste modifiable. On applique
-- ici exactement le meme test, en aval. Deux regles divergentes pour une meme
-- notion, c'est la garantie qu'elles finiront par se contredire.

-- 1. Un etat terminal honnete.
--
-- `manual_resolved` existe deja mais signifie qu'un humain a traite le cas.
-- L'employer ici ferait croire a du travail accompli et fausserait toute
-- lecture ulterieure du rendement reel de l'exploitation.
ALTER TABLE public.auto_fix_jobs DROP CONSTRAINT IF EXISTS auto_fix_jobs_state_check;
ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_state_check CHECK (state IN (
    'queued', 'claimed', 'planned', 'applying', 'applied', 'retry_wait',
    'retry_verify', 'simulated', 'pending_manual', 'verified',
    'manual_resolved', 'permanent_failed', 'applied_unverified', 'obsolete'
  ));

-- 2. Consigner POURQUOI.
--
-- Champ dedie plutot que `last_error_json` : une fermeture pour cause de colis
-- parti n'est pas une erreur, et melanger les deux rendrait illisible le jour
-- ou l'on cherchera de vraies pannes.
ALTER TABLE public.auto_fix_jobs
  ADD COLUMN IF NOT EXISTS closure_json jsonb;

COMMENT ON COLUMN public.auto_fix_jobs.closure_json IS
  'Pourquoi la tache a ete refermee sans correction (colis deja parti, etc.).';

CREATE OR REPLACE FUNCTION public.close_obsolete_auto_fix_jobs(p_limit integer DEFAULT 500)
RETURNS TABLE(closed integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed integer := 0;
BEGIN
  -- Borne volontaire : un balayage non borne sur une file qui aurait derape
  -- verrouillerait la table pendant que l'exploitation la consulte.
  IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 5000 THEN
    p_limit := 500;
  END IF;

  WITH candidates AS (
    SELECT j.id, s.status_id, s.status_message
    FROM public.auto_fix_jobs j
    JOIN public.shipments s
      ON s.sendcloud_id::text = j.source_sendcloud_id
     AND s.tenant_id = j.tenant_id
    WHERE j.state = 'pending_manual'
      AND j.source_kind = 'parcel'
      -- Le colis a ete annonce au transporteur...
      AND s.date_announced IS NOT NULL
      -- ...et n'est plus dans un etat modifiable.
      AND s.status_id IS NOT NULL
      AND s.status_id NOT IN (1000, 1002)
    ORDER BY j.created_at
    LIMIT p_limit
    FOR UPDATE OF j SKIP LOCKED
  ), updated AS (
    UPDATE public.auto_fix_jobs j
    SET state = 'obsolete',
        cancelled_at = now(),
        updated_at = now(),
        closure_json = jsonb_build_object(
          'reason', 'parcel_no_longer_correctable',
          'status_id', c.status_id,
          'status_message', c.status_message,
          'closed_at', now()
        )
    FROM candidates c
    WHERE j.id = c.id
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_closed FROM updated;

  RETURN QUERY
  SELECT v_closed,
         (SELECT count(*)::integer FROM public.auto_fix_jobs WHERE state = 'pending_manual');
END;
$$;

-- Un GRANT a PUBLIC est implicite a la creation : le revoquer n'est pas
-- decoratif. Revoquer a `anon` seul serait un no-op, PUBLIC couvrant tout role.
REVOKE ALL ON FUNCTION public.close_obsolete_auto_fix_jobs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_obsolete_auto_fix_jobs(integer) FROM anon;
REVOKE ALL ON FUNCTION public.close_obsolete_auto_fix_jobs(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.close_obsolete_auto_fix_jobs(integer) TO service_role;

COMMENT ON FUNCTION public.close_obsolete_auto_fix_jobs(integer) IS
  'Referme les taches manuelles dont le colis est parti. Meme regle que detect.ts.';

-- 3. Balayage horaire.
--
-- Purement SQL : pas d'appel HTTP, donc rien qui puisse expirer ni dependre du
-- reveil d'un service. Le resultat reste verifiable a tout moment par
--   SELECT count(*) FROM auto_fix_jobs
--   WHERE state = 'obsolete' AND cancelled_at > now() - interval '1 day';
SELECT cron.unschedule('auto-fix-close-obsolete')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-fix-close-obsolete');

SELECT cron.schedule(
  'auto-fix-close-obsolete',
  '40 * * * *',
  $$SELECT public.close_obsolete_auto_fix_jobs(500)$$
);
