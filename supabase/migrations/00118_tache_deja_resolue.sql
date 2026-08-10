-- Une tache dont la cause a disparu n'est pas du travail manuel.
--
-- CONSTAT (10/08) : 7 taches figuraient dans la file de corrections manuelles
-- avec le motif `already_resolved` ou `nothing_to_shorten`. Le moteur avait
-- relu la commande et constate qu'il n'y avait PLUS RIEN a corriger — le plus
-- souvent parce que l'exploitation l'avait deja fait a la main.
--
-- Ces taches etaient donc presentees comme du travail restant alors que le
-- probleme etait resolu. C'est la meme erreur que partout ailleurs dans ce
-- projet : un tableau qui annonce plus de travail qu'il n'y en a finit ignore.
--
-- Elles faussaient aussi le taux d'escalade, en comptant comme des echecs des
-- cas ou tout s'est bien passe.
--
-- `already_resolved` n'est pas un echec : c'est une reussite par une autre
-- voie. Elle recoit donc son propre etat terminal.

ALTER TABLE public.auto_fix_jobs DROP CONSTRAINT IF EXISTS auto_fix_jobs_error_category_check;
ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_error_category_check CHECK (
    error_category IS NULL OR error_category = ANY (ARRAY[
      'retryable', 'non_retryable', 'configuration', 'internal', 'unknown',
      'mismatch', 'verification_failed', 'write_rejected', 'write_uncertain',
      -- Nouveau : la cause a disparu avant qu'on agisse.
      'resolved'
    ])
  );

CREATE OR REPLACE FUNCTION public.fail_auto_fix_live(p_job_id uuid, p_worker_id text, p_error jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- La cause a disparu : etat terminal, et surtout PAS la file manuelle.
  -- Le compteur de tentatives n'est pas incremente non plus — il n'y a eu
  -- aucun echec a comptabiliser.
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
$$;

COMMENT ON FUNCTION public.fail_auto_fix_live(uuid, text, jsonb) IS
  'Issue d une tache live. La categorie `resolved` signale une cause disparue : etat terminal manual_resolved, jamais la file manuelle.';
