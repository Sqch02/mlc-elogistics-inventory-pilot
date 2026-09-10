-- Une panne cote transporteur n'est pas un echec de la tache.
--
-- Le 10/09 au matin, l'API points relais de Sendcloud n'a plus renvoye un
-- seul point Mondial Relay en France, alors que Colis Prive et Chronopost
-- repondaient normalement. 272 commandes ont ete detectees d'un coup avec
-- « Service point no longer operational », le moteur a repondu « aucun
-- remplacant » pour chacune, et les a renvoyees en file manuelle, cinq par
-- passage, a un exploitant qui ne pouvait rien en faire non plus.
--
-- Les marquer « reessayables » n'aurait pas suffi : au troisieme echec, une
-- tache reessayable passe en echec definitif, un etat que personne ne
-- regarde. Une panne qui dure une heure aurait fait disparaitre 271 taches
-- en silence.
--
-- D'ou cette categorie : `outage`. La tache attend deux heures et reessaie,
-- SANS user son compteur de tentatives, tant que la panne dure. Quand le
-- catalogue revient, elle se resout ou se corrige comme si de rien n'etait.

ALTER TABLE public.auto_fix_jobs
  DROP CONSTRAINT IF EXISTS auto_fix_jobs_error_category_check;

ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_error_category_check CHECK (
    error_category IS NULL OR error_category = ANY (ARRAY[
      'retryable',
      'non_retryable',
      'configuration',
      'internal',
      'unknown',
      'mismatch',
      'verification_failed',
      'write_rejected',
      'write_uncertain',
      'resolved',
      'obsolete',
      -- Ajoutee par 00139 : panne cote transporteur ou Sendcloud, on attend
      -- son retour sans consommer de tentative.
      'outage'
    ]::text[])
  );

CREATE OR REPLACE FUNCTION public.fail_auto_fix_live(p_job_id uuid, p_worker_id text, p_error jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.auto_fix_jobs;
  v_category text := COALESCE(p_error->>'category', 'unknown');
  v_next_state text;
  v_failures smallint;
BEGIN
  SELECT * INTO v_job FROM public.auto_fix_jobs
  WHERE id = p_job_id AND worker_id = p_worker_id AND mode = 'live'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_job.write_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'job % a deja commence une ecriture: utiliser fail_auto_fix_verification', p_job_id;
  END IF;

  v_failures := v_job.attempt_count + 1;

  IF v_category = 'resolved' THEN
    UPDATE public.auto_fix_jobs
    SET state = 'manual_resolved',
        last_error_json = p_error,
        error_category = v_category,
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_job_id;
    RETURN 'manual_resolved';
  END IF;

  -- La source n'est plus corrigeable : sans objet, et non « a traiter ».
  -- Le compteur de tentatives n'est pas incremente : rien n'a echoue, il n'y
  -- avait simplement plus rien a faire.
  IF v_category = 'obsolete' THEN
    UPDATE public.auto_fix_jobs
    SET state = 'obsolete',
        last_error_json = p_error,
        error_category = v_category,
        cancelled_at = now(),
        closure_json = jsonb_build_object(
          'reason', COALESCE(p_error->>'reason', 'source_not_correctable'),
          'detail', p_error->>'detail',
          'observed_by', 'live_worker',
          'closed_at', now()
        ),
        updated_at = now()
    WHERE id = p_job_id;
    RETURN 'obsolete';
  END IF;

  -- Panne exterieure : on attend, sans que la tache en porte la marque.
  IF v_category = 'outage' THEN
    UPDATE public.auto_fix_jobs
    SET state = 'retry_wait',
        last_error_json = p_error,
        error_category = v_category,
        next_attempt_at = now() + interval '2 hours',
        worker_id = NULL,
        locked_until = NULL,
        updated_at = now()
    WHERE id = p_job_id;
    RETURN 'retry_wait';
  END IF;

  IF v_category IN ('non_retryable', 'configuration') THEN
    v_next_state := 'pending_manual';
  ELSIF v_failures >= 3 THEN
    v_next_state := 'permanent_failed';
  ELSE
    v_next_state := 'retry_wait';
  END IF;

  UPDATE public.auto_fix_jobs
  SET state = v_next_state,
      attempt_count = v_failures,
      last_error_json = p_error,
      error_category = v_category,
      next_attempt_at = CASE WHEN v_next_state = 'retry_wait'
        THEN now() + make_interval(mins => LEAST(60, 5 * (2 ^ (v_failures - 1)))::integer)
        ELSE next_attempt_at END,
      worker_id = CASE WHEN v_next_state IN ('retry_wait') THEN NULL ELSE worker_id END,
      locked_until = CASE WHEN v_next_state IN ('retry_wait') THEN NULL ELSE locked_until END,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN v_next_state;
END;
$function$;
