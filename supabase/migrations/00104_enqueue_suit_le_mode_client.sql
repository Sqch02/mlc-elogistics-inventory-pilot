-- La mise en file doit suivre le mode du client.
--
-- CE QUI BLOQUAIT, et c'etait invisible. `enqueue_auto_fix_jobs` datait de
-- 00093, quand seule la simulation existait. Elle portait deux verrous :
--
--     WHERE COALESCE(elem->>'mode','') <> 'simulated'
--       -> RAISE EXCEPTION '00093 est dry-run only: mode simulated requis'
--
--     WHERE ts.auto_fix_mode = 'simulated'
--
-- Le premier rejetait toute tache en mode ecriture. Le second ecartait tout
-- client qui n'etait pas en simulation. Un client arme en 'live' ne pouvait
-- donc RIEN mettre en file — et comme la synchronisation attrape l'exception
-- pour ne jamais faire echouer la synchro elle-meme, l'echec ne se voyait
-- nulle part. Le client paraissait simplement ne plus avoir d'erreurs.
--
-- LE BON INVARIANT n'est pas "simulation uniquement" mais "le mode de la tache
-- doit egaler celui du client". C'est ce que la reclamation exige deja de son
-- cote ; sans le meme controle ici, on pourrait creer des taches que personne
-- ne reclamera jamais.

CREATE OR REPLACE FUNCTION public.enqueue_auto_fix_jobs(p_jobs jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF jsonb_typeof(p_jobs) <> 'array' THEN
    RAISE EXCEPTION 'p_jobs doit etre un tableau JSON';
  END IF;
  IF jsonb_array_length(p_jobs) > 250 THEN
    RAISE EXCEPTION 'p_jobs est limite a 250 elements';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_jobs) elem
    WHERE COALESCE(elem->>'mode', '') NOT IN ('simulated', 'live')
  ) THEN
    RAISE EXCEPTION 'mode doit valoir simulated ou live';
  END IF;

  WITH input AS (
    SELECT * FROM jsonb_to_recordset(p_jobs) AS x(
      tenant_id uuid,
      shipment_id uuid,
      source_kind text,
      source_sendcloud_id text,
      source_order_ref_hash text,
      source_fingerprint text,
      primary_pattern text,
      detected_patterns text[],
      mode text,
      operation_key text,
      priority smallint,
      evidence_json jsonb,
      source_summary_json jsonb,
      original_sendcloud_id text,
      source_observed_at timestamptz
    )
  ), upserted AS (
    INSERT INTO public.auto_fix_jobs (
      tenant_id, shipment_id, source_kind, source_sendcloud_id, source_order_ref_hash,
      source_fingerprint, primary_pattern, detected_patterns, mode, operation_key,
      priority, evidence_json, source_summary_json, original_sendcloud_id,
      source_observed_at
    )
    SELECT
      i.tenant_id, i.shipment_id, i.source_kind, i.source_sendcloud_id, i.source_order_ref_hash,
      i.source_fingerprint, i.primary_pattern, i.detected_patterns, i.mode, i.operation_key,
      COALESCE(i.priority, 100), COALESCE(i.evidence_json, '{}'::jsonb),
      COALESCE(i.source_summary_json, '{}'::jsonb), i.original_sendcloud_id,
      COALESCE(i.source_observed_at, now())
    FROM input i
    JOIN public.tenant_settings ts ON ts.tenant_id = i.tenant_id
    JOIN public.shipments s
      ON s.id = i.shipment_id
     AND s.tenant_id = i.tenant_id
     AND s.sendcloud_id = i.source_sendcloud_id
    -- Le mode de la tache doit egaler celui du client. Creer une tache dans un
    -- autre mode reviendrait a la rendre irreclamable a jamais.
    WHERE ts.auto_fix_mode = i.mode
    ON CONFLICT (operation_key) DO UPDATE SET
      last_seen_at = now(),
      source_observed_at = GREATEST(auto_fix_jobs.source_observed_at, EXCLUDED.source_observed_at),
      shipment_id = COALESCE(auto_fix_jobs.shipment_id, EXCLUDED.shipment_id)
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM upserted;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_auto_fix_jobs(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_auto_fix_jobs(jsonb) TO service_role;

COMMENT ON FUNCTION public.enqueue_auto_fix_jobs(jsonb) IS
  'Met en file les taches auto-fix. Le mode de la tache doit egaler celui du client.';
