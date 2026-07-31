-- Une ecriture partie sans trace doit pouvoir se conclure.
--
-- LE SCENARIO, observe en production. Le worker commit son intention
-- (`applying`), envoie l'ecriture, puis appelle `mark_auto_fix_applied`. Si
-- quelque chose interrompt entre l'envoi et cet appel — redemarrage, coupure
-- reseau, delai depasse — le job reste en `applying` avec `write_started_at`
-- pose.
--
-- La reprise fait alors ce qu'il faut : elle relit le colis et constate que la
-- correction EST appliquee. Mais `verify_auto_fix_live` n'acceptait que
-- 'applied' et 'retry_verify'. Le job ne pouvait donc jamais conclure, et
-- repartait toutes les quinze minutes. Constate : un job repris pendant plus
-- de vingt-quatre heures, avec verify_attempt_count reste a zero.
--
-- C'est le pire genre de defaut : la machine a etats decrivait bien le
-- scenario de crash, mais aucune transition ne permettait d'en sortir.

CREATE OR REPLACE FUNCTION public.verify_auto_fix_live(
  p_job_id uuid,
  p_worker_id text,
  p_verification jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.auto_fix_jobs;
  v_updated integer;
BEGIN
  SELECT * INTO v_job FROM public.auto_fix_jobs
  WHERE id = p_job_id AND worker_id = p_worker_id AND mode = 'live'
    -- 'applying' est desormais accepte : une ecriture partie dont la trace
    -- n'a pas ete commitee reste une ecriture, et la relecture vient de le
    -- confirmer.
    AND state IN ('applied', 'retry_verify', 'applying')
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.auto_fix_jobs
  SET state = 'verified',
      verified_at = now(),
      applied_at = COALESCE(applied_at, now()),
      worker_id = NULL,
      locked_until = NULL,
      last_error_json = NULL,
      error_category = NULL,
      updated_at = now()
  WHERE id = p_job_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RETURN false; END IF;

  -- La trace peut manquer si l'interruption a eu lieu avant son ecriture. On
  -- la cree alors, sans quoi une correction reelle n'aurait aucune trace —
  -- exactement le cas ou l'on en a le plus besoin.
  INSERT INTO public.auto_fixes (
    tenant_id, job_id, shipment_id, event_key, operation_key, mode,
    primary_pattern, detected_patterns, source_kind, source_sendcloud_id,
    original_sendcloud_id, result_sendcloud_id, action, status,
    source_fingerprint, before_json, after_json, source_order_ref
  )
  SELECT
    v_job.tenant_id, v_job.id, v_job.shipment_id,
    v_job.operation_key || ':applied', v_job.operation_key, v_job.mode,
    v_job.primary_pattern, v_job.detected_patterns, v_job.source_kind,
    v_job.source_sendcloud_id, v_job.original_sendcloud_id,
    COALESCE(v_job.result_sendcloud_id, v_job.original_sendcloud_id),
    CASE WHEN v_job.source_kind = 'parcel' THEN 'put_update' ELSE 'patch_order_v3' END,
    'verified', v_job.source_fingerprint,
    jsonb_build_object('recovered', true, 'note', 'trace reconstituee a la reprise'),
    COALESCE(p_verification, '{}'::jsonb),
    (SELECT s.order_ref FROM public.shipments s WHERE s.id = v_job.shipment_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.auto_fixes a WHERE a.job_id = v_job.id
  )
  ON CONFLICT (event_key) DO NOTHING;

  UPDATE public.auto_fixes
  SET status = 'verified',
      after_json = COALESCE(p_verification, after_json)
  WHERE job_id = p_job_id AND status = 'applied';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_auto_fix_live(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_auto_fix_live(uuid, text, jsonb) TO service_role;
