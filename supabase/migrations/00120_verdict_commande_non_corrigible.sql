-- Une commande devenue non corrigible n'a rien a faire dans la file manuelle.
--
-- LE CONSTAT
-- Quand le moteur tente une correction, il relit d'abord la commande chez
-- Sendcloud. Si son statut n'est plus `on_hold` ni `unfulfilled`, elle est
-- partie : la corriger n'aurait aucun effet sur une etiquette deja imprimee.
-- Le moteur renonce donc, a juste titre, avec la raison
-- `order_not_corrigible`.
--
-- Mais ce renoncement etait classe `non_retryable`, et tout ce qui est
-- `non_retryable` atterrit dans la file manuelle. Or il n'y a rien a y faire :
-- personne ne peut corriger une commande partie. La tache y restait donc
-- indefiniment. Deux exemplaires attendaient depuis le 11/08.
--
-- POURQUOI CE N'EST PAS UN BALAYAGE DE PLUS
-- La migration 00119 referme apres coup, en deduisant d'un colis frere que la
-- commande est partie. Ici, le moteur SAIT : il vient de lire le statut chez
-- Sendcloud. Router ce verdict vers un etat terminal des sa production vaut
-- mieux que de le rattraper une heure plus tard par inference. C'est le meme
-- raisonnement qu'a la migration 00118 pour `resolved`.
--
-- On ne route QUE ce verdict-la. `order_lookup_not_found` lui ressemble mais
-- ne dit pas la meme chose : la commande n'a pas ete trouvee, ce qui peut aussi
-- signifier un mauvais numero — donc un probleme de rapprochement a voir, pas
-- une tache a refermer en silence.

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
