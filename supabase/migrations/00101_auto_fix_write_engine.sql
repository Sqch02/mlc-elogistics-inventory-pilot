-- Moteur d'ecriture auto-fix : chemin live.
--
-- FILE ONLY tant que le perimetre n'est pas tranche. Cette migration ne fait
-- rien tant qu'aucun tenant n'est en auto_fix_mode='live' : elle ajoute des
-- capacites, elle n'en active aucune.
--
-- Conception : docs/plans/2026-07-25-auto-fix-write-engine-design.md (V2, apres
-- une revue adversariale qui a rejete la V1).
--
-- CE QUI PORTE TOUTE LA SURETE, et pourquoi la V1 se trompait :
-- La V1 persistait l'etat "ecrit" APRES le retour de Sendcloud, en pensant
-- qu'un crash serait alors inoffensif. Faux. La fenetre dangereuse est entre
-- l'octet envoye et le commit qui en garde la trace : pendant cet intervalle le
-- job est en 'planned', l'etat que le predicat de reprise ressuscite. Et il ne
-- faut meme pas un crash : un simple echec du commit suffit a declencher une
-- seconde ecriture.
-- On persiste donc l'INTENTION d'ecrire AVANT l'appel reseau. Tout job portant
-- write_started_at part en verification seule, quel que soit son etat.

-- ---------------------------------------------------------------------------
-- 1. Etat 'applying' et trace durable de l'intention d'ecrire
-- ---------------------------------------------------------------------------

ALTER TABLE public.auto_fix_jobs
  ADD COLUMN IF NOT EXISTS write_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS write_request_hash text,
  ADD COLUMN IF NOT EXISTS verify_attempt_count smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.auto_fix_jobs.write_started_at IS
  'Commite AVANT l''appel reseau. Non nul => verification seule, jamais de nouvelle ecriture.';

-- Les etats 'applying', 'retry_verify' et 'applied_unverified' completent la
-- machine. 'applied_unverified' est terminal : l'ecriture a eu lieu mais n'a
-- pas pu etre confirmee, un humain doit trancher.
ALTER TABLE public.auto_fix_jobs DROP CONSTRAINT IF EXISTS auto_fix_jobs_state_check;
ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_state_check CHECK (state IN (
    'queued', 'claimed', 'planned', 'applying', 'applied', 'retry_wait',
    'retry_verify', 'simulated', 'pending_manual', 'verified',
    'manual_resolved', 'permanent_failed', 'applied_unverified'
  ));

-- La contrainte de verrou ne tolerait worker_id/locked_until que pour
-- ('claimed','planned') : sans cette extension, tout passage en 'applying' est
-- rejete par la base.
ALTER TABLE public.auto_fix_jobs DROP CONSTRAINT IF EXISTS auto_fix_jobs_lock_consistency;
ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_lock_consistency CHECK (
    (state IN ('claimed', 'planned', 'applying', 'applied', 'retry_verify')
      AND worker_id IS NOT NULL AND locked_until IS NOT NULL)
    OR state NOT IN ('claimed', 'planned', 'applying', 'applied', 'retry_verify')
  );

-- Invariant central, porte par la base et pas seulement par le code : un job
-- qui a commence a ecrire ne peut plus revenir a un etat qui replanifie.
ALTER TABLE public.auto_fix_jobs DROP CONSTRAINT IF EXISTS auto_fix_jobs_no_rewrite_after_start;
ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_no_rewrite_after_start CHECK (
    write_started_at IS NULL
    OR state NOT IN ('queued', 'claimed', 'planned', 'retry_wait')
  );

-- Le routeur post-ecriture a son propre vocabulaire, disjoint de celui du
-- routeur pre-ecriture. Sans cette extension, CHAQUE appel a
-- fail_auto_fix_verification violait la contrainte de 00093 et echouait -- en
-- silence, car l'appelant ne lit pas l'erreur. Toute la gestion d'echec
-- post-ecriture etait donc du code mort.
ALTER TABLE public.auto_fix_jobs DROP CONSTRAINT IF EXISTS auto_fix_jobs_error_category_check;
ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_error_category_check CHECK (
    error_category IS NULL OR error_category IN (
      -- pre-ecriture (00093)
      'retryable', 'non_retryable', 'configuration', 'internal', 'unknown',
      -- post-ecriture (00101) : le patch n'a pas pris, ou on ignore s'il a pris
      'mismatch', 'verification_failed', 'write_rejected', 'write_uncertain'
    )
  );

ALTER TABLE public.auto_fixes DROP CONSTRAINT IF EXISTS auto_fixes_status_check;
ALTER TABLE public.auto_fixes
  ADD CONSTRAINT auto_fixes_status_check CHECK (status IN (
    'simulated', 'applied', 'verified', 'retry_wait', 'pending_manual',
    'manual_resolved', 'permanent_failed', 'applied_unverified'
  ));

-- Reprise : retrouver les jobs en cours d'ecriture sans scanner la table.
CREATE INDEX IF NOT EXISTS idx_auto_fix_jobs_resume_live
  ON public.auto_fix_jobs (tenant_id, write_started_at)
  WHERE write_started_at IS NOT NULL
    AND state IN ('applying', 'applied', 'retry_verify');

-- ---------------------------------------------------------------------------
-- 2. Reclamation : etendue au mode, pas dupliquee
-- ---------------------------------------------------------------------------
-- p_mode est ajoute EN DERNIER avec un defaut : les appels existants restent
-- valides. Un job live n'est reclamable que si le tenant est lui-meme en live.

-- L'ancienne signature a 4 arguments DOIT etre supprimee : la conserver a cote
-- de la nouvelle rendrait tout appel a 4 arguments AMBIGU, et casserait le
-- worker dry-run deja en production des l'application de cette migration.
DROP FUNCTION IF EXISTS public.claim_auto_fix_jobs(uuid, integer, integer, text);

CREATE OR REPLACE FUNCTION public.claim_auto_fix_jobs(
  p_tenant_id uuid,
  p_limit integer DEFAULT 5,
  p_lock_seconds integer DEFAULT 120,
  p_worker_id text DEFAULT NULL,
  p_mode text DEFAULT 'simulated'
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'p_tenant_id requis'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10 THEN
    RAISE EXCEPTION 'p_limit doit etre entre 1 et 10';
  END IF;
  IF p_lock_seconds IS NULL OR p_lock_seconds < 30 OR p_lock_seconds > 300 THEN
    RAISE EXCEPTION 'p_lock_seconds doit etre entre 30 et 300';
  END IF;
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) < 8 THEN
    RAISE EXCEPTION 'p_worker_id requis (8 caracteres minimum)';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('simulated', 'live') THEN
    RAISE EXCEPTION 'p_mode doit valoir simulated ou live';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.auto_fix_jobs j
    JOIN public.tenant_settings ts ON ts.tenant_id = j.tenant_id
    WHERE j.tenant_id = p_tenant_id
      AND j.mode = p_mode
      AND ts.auto_fix_mode = p_mode
      -- Un job ayant commence a ecrire n'est JAMAIS repris par ici : il
      -- appartient a resume_auto_fix_writes.
      AND j.write_started_at IS NULL
      AND (
        (j.state IN ('queued', 'retry_wait') AND j.next_attempt_at <= now())
        OR (j.state IN ('claimed', 'planned') AND j.locked_until < now())
      )
    ORDER BY j.priority DESC, j.next_attempt_at, j.created_at, j.id
    LIMIT p_limit
    FOR UPDATE OF j SKIP LOCKED
  ), claimed AS (
    UPDATE public.auto_fix_jobs j
    SET state = 'claimed',
        worker_id = p_worker_id,
        locked_until = now() + make_interval(secs => p_lock_seconds),
        claimed_at = now(),
        claim_count = j.claim_count + 1,
        updated_at = now()
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.*
  )
  SELECT to_jsonb(claimed.*) FROM claimed;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reprise des ecritures : ne rend QUE des jobs a verifier
-- ---------------------------------------------------------------------------
-- Cette RPC ne change pas l'etat des jobs qu'elle rend : la decision de reprise
-- se prend sur des faits durables (write_started_at), jamais sur `state`, que
-- la reclamation ecrase via RETURNING post-update.

CREATE OR REPLACE FUNCTION public.resume_auto_fix_writes(
  p_tenant_id uuid,
  p_worker_id text,
  p_limit integer DEFAULT 5,
  p_lock_seconds integer DEFAULT 120
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'p_tenant_id requis'; END IF;
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) < 8 THEN
    RAISE EXCEPTION 'p_worker_id requis (8 caracteres minimum)';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10 THEN
    RAISE EXCEPTION 'p_limit doit etre entre 1 et 10';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.auto_fix_jobs j
    WHERE j.tenant_id = p_tenant_id
      AND j.write_started_at IS NOT NULL
      AND j.state IN ('applying', 'applied', 'retry_verify')
      AND (j.locked_until IS NULL OR j.locked_until < now())
    ORDER BY j.write_started_at
    LIMIT p_limit
    FOR UPDATE OF j SKIP LOCKED
  ), leased AS (
    UPDATE public.auto_fix_jobs j
    SET worker_id = p_worker_id,
        locked_until = now() + make_interval(secs => p_lock_seconds),
        updated_at = now()
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.*
  )
  SELECT to_jsonb(leased.*) FROM leased;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Planification live
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.plan_auto_fix_live(
  p_job_id uuid,
  p_worker_id text,
  p_plan jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.auto_fix_jobs
  SET state = 'planned',
      plan_json = p_plan,
      planned_at = now(),
      updated_at = now()
  WHERE id = p_job_id
    AND worker_id = p_worker_id
    AND locked_until > now()
    AND mode = 'live'
    AND state = 'claimed'
    -- Une planification sur un job deja parti en ecriture est interdite.
    AND write_started_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. LE point critique : commiter l'intention AVANT le reseau
-- ---------------------------------------------------------------------------
-- Le worker n'a le droit d'appeler Sendcloud que si cette RPC a renvoye true.
-- Elle renouvelle aussi le bail : le bail de la reclamation est pris par LOT,
-- et le dernier job d'un lot peut l'atteindre expire.

CREATE OR REPLACE FUNCTION public.begin_auto_fix_write(
  p_job_id uuid,
  p_worker_id text,
  p_request_hash text,
  p_lock_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_request_hash IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'p_request_hash doit etre un sha256';
  END IF;

  UPDATE public.auto_fix_jobs
  SET state = 'applying',
      write_started_at = now(),
      write_request_hash = p_request_hash,
      attempt_count = attempt_count + 1,
      locked_until = now() + make_interval(secs => p_lock_seconds),
      updated_at = now()
  WHERE id = p_job_id
    AND worker_id = p_worker_id
    AND locked_until > now()
    AND mode = 'live'
    AND state = 'planned'
    AND write_started_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Tracage du resultat, puis verification
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_auto_fix_applied(
  p_job_id uuid,
  p_worker_id text,
  p_result_sendcloud_id text,
  p_before jsonb,
  p_after jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.auto_fix_jobs;
BEGIN
  SELECT * INTO v_job FROM public.auto_fix_jobs
  WHERE id = p_job_id AND worker_id = p_worker_id AND mode = 'live'
    AND state = 'applying'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.auto_fix_jobs
  SET state = 'applied',
      applied_at = now(),
      result_sendcloud_id = COALESCE(p_result_sendcloud_id, result_sendcloud_id),
      updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO public.auto_fixes (
    tenant_id, job_id, shipment_id, event_key, operation_key, mode,
    primary_pattern, detected_patterns, source_kind, source_sendcloud_id,
    original_sendcloud_id, result_sendcloud_id, action, status,
    source_fingerprint, before_json, after_json
  ) VALUES (
    v_job.tenant_id, v_job.id, v_job.shipment_id,
    v_job.operation_key || ':applied', v_job.operation_key, v_job.mode,
    v_job.primary_pattern, v_job.detected_patterns, v_job.source_kind,
    v_job.source_sendcloud_id, v_job.original_sendcloud_id,
    COALESCE(p_result_sendcloud_id, v_job.original_sendcloud_id),
    'put_update', 'applied', v_job.source_fingerprint, p_before, p_after
  )
  ON CONFLICT (event_key) DO NOTHING;

  RETURN true;
END;
$$;

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
  v_updated integer;
BEGIN
  UPDATE public.auto_fix_jobs
  SET state = 'verified',
      verified_at = now(),
      worker_id = NULL,
      locked_until = NULL,
      last_error_json = NULL,
      error_category = NULL,
      updated_at = now()
  WHERE id = p_job_id
    AND worker_id = p_worker_id
    AND mode = 'live'
    AND state IN ('applied', 'retry_verify');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RETURN false; END IF;

  UPDATE public.auto_fixes
  SET status = 'verified',
      after_json = COALESCE(p_verification, after_json)
  WHERE job_id = p_job_id AND status = 'applied';

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. DEUX routeurs d'echec distincts
-- ---------------------------------------------------------------------------
-- La V1 n'en avait qu'un, et il renvoyait en reecriture un job deja ecrit : une
-- simple erreur 429 a la verification suffisait a declencher un second PUT.

-- Echecs PRE-ecriture uniquement. Refuse si l'ecriture a commence.
CREATE OR REPLACE FUNCTION public.fail_auto_fix_live(
  p_job_id uuid,
  p_worker_id text,
  p_error jsonb
)
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

  -- Garde structurelle : ce routeur ne touche jamais un job deja parti en
  -- ecriture. Celui-la releve de fail_auto_fix_verification.
  IF v_job.write_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'job % a deja commence une ecriture: utiliser fail_auto_fix_verification', p_job_id;
  END IF;

  v_failures := v_job.attempt_count + 1;

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

-- Echecs POST-ecriture. Ce routeur ne peut structurellement pas produire une
-- nouvelle ecriture : il ne connait que retry_verify et applied_unverified.
CREATE OR REPLACE FUNCTION public.fail_auto_fix_verification(
  p_job_id uuid,
  p_worker_id text,
  p_error jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.auto_fix_jobs;
  v_next_state text;
  v_attempts smallint;
BEGIN
  SELECT * INTO v_job FROM public.auto_fix_jobs
  WHERE id = p_job_id AND worker_id = p_worker_id AND mode = 'live'
    AND state IN ('applying', 'applied', 'retry_verify')
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NULL; END IF;

  v_attempts := v_job.verify_attempt_count + 1;

  -- Un ecart constate part directement en revue : reessayer ne changerait rien.
  IF COALESCE(p_error->>'category', '') = 'mismatch' OR v_attempts >= 3 THEN
    v_next_state := 'applied_unverified';
  ELSE
    v_next_state := 'retry_verify';
  END IF;

  UPDATE public.auto_fix_jobs
  SET state = v_next_state,
      verify_attempt_count = v_attempts,
      last_error_json = p_error,
      error_category = COALESCE(p_error->>'category', 'unknown'),
      next_attempt_at = now() + make_interval(mins => LEAST(30, 5 * v_attempts)),
      worker_id = CASE WHEN v_next_state = 'applied_unverified' THEN NULL ELSE worker_id END,
      locked_until = CASE WHEN v_next_state = 'applied_unverified' THEN NULL ELSE locked_until END,
      updated_at = now()
  WHERE id = p_job_id;

  UPDATE public.auto_fixes
  SET status = CASE WHEN v_next_state = 'applied_unverified' THEN 'applied_unverified' ELSE status END,
      error_json = p_error
  WHERE job_id = p_job_id AND status = 'applied';

  RETURN v_next_state;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Tenants en live
-- ---------------------------------------------------------------------------
-- Inclut les etats de reprise : sans cela un tenant n'ayant que des jobs en
-- cours d'ecriture ne serait meme pas visite, et ses ecritures resteraient
-- eternellement non verifiees.

CREATE OR REPLACE FUNCTION public.get_auto_fix_live_tenants(p_limit integer DEFAULT 20)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'p_limit doit etre entre 1 et 50';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'tenant_id', ts.tenant_id,
    'max_candidates', ts.auto_fix_max_candidates
  )
  FROM public.tenant_settings ts
  WHERE ts.auto_fix_mode = 'live'
    AND EXISTS (
      SELECT 1 FROM public.auto_fix_jobs j
      WHERE j.tenant_id = ts.tenant_id
        AND j.mode = 'live'
        AND (
          j.state IN ('queued', 'retry_wait', 'claimed', 'planned')
          OR (j.write_started_at IS NOT NULL
              AND j.state IN ('applying', 'applied', 'retry_verify'))
        )
    )
  ORDER BY ts.tenant_id
  LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Retention PII : couvrir aussi les etats d'ecriture
-- ---------------------------------------------------------------------------
-- Sans cela, la PII des jobs ayant reellement ecrit n'expirerait jamais.

CREATE OR REPLACE FUNCTION public.cleanup_auto_fix_pii(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION 'p_limit doit etre entre 1 et 5000';
  END IF;

  WITH expired AS (
    SELECT id FROM public.auto_fixes
    WHERE pii_redacted_at IS NULL
      AND pii_expires_at <= now()
    ORDER BY pii_expires_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), redacted AS (
    UPDATE public.auto_fixes a
    SET before_json = NULL,
        after_json = NULL,
        pii_redacted_at = now()
    FROM expired e
    WHERE a.id = e.id
    RETURNING a.id
  )
  SELECT count(*) INTO v_count FROM redacted;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Droits : service_role uniquement, aucun acces client
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.claim_auto_fix_jobs(uuid, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resume_auto_fix_writes(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_auto_fix_live(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_auto_fix_write(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_auto_fix_applied(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_auto_fix_live(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_auto_fix_live(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_auto_fix_verification(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_auto_fix_live_tenants(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_auto_fix_pii(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_auto_fix_jobs(uuid, integer, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resume_auto_fix_writes(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_auto_fix_live(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_auto_fix_write(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_auto_fix_applied(uuid, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_auto_fix_live(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_auto_fix_live(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_auto_fix_verification(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auto_fix_live_tenants(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_auto_fix_pii(integer) TO service_role;
