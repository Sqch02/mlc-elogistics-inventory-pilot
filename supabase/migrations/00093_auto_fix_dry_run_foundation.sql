-- Phase 2 / lot fondations : file de jobs et audit auto-fix en dry-run.
-- Cette migration ne cree AUCUNE fonction d'ecriture Sendcloud ou stock.
-- Les jobs live sont representables pour stabiliser le schema, mais les RPC
-- d'enqueue/claim de cette version refusent tout mode autre que simulated.

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS auto_fix_mode text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS auto_fix_max_candidates smallint NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_settings_auto_fix_mode_check'
      AND conrelid = 'public.tenant_settings'::regclass
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_auto_fix_mode_check
      CHECK (auto_fix_mode IN ('off', 'simulated', 'live'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_settings_auto_fix_max_candidates_check'
      AND conrelid = 'public.tenant_settings'::regclass
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_auto_fix_max_candidates_check
      CHECK (auto_fix_max_candidates BETWEEN 1 AND 10);
  END IF;
END $$;

COMMENT ON COLUMN public.tenant_settings.auto_fix_mode IS
  'Priorite apres AUTO_FIX_PAUSED: off, simulated, live. Le worker 00093 refuse live.';
COMMENT ON COLUMN public.tenant_settings.auto_fix_max_candidates IS
  'Plafond par tenant et par run du worker auto-fix (1..10).';

CREATE TABLE IF NOT EXISTS public.auto_fix_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('parcel', 'integration_shipment')),
  source_sendcloud_id text NOT NULL,
  source_order_ref_hash text,
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
  primary_pattern text NOT NULL CHECK (primary_pattern IN (
    'currency_chf', 'address_too_long', 'hs_code_missing', 'weight_too_low',
    'service_point_missing', 'sender_eori_missing', 'unknown'
  )),
  detected_patterns text[] NOT NULL,
  mode text NOT NULL CHECK (mode IN ('simulated', 'live')),
  operation_key text NOT NULL UNIQUE CHECK (operation_key ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN (
    'queued', 'claimed', 'planned', 'applied', 'retry_wait', 'simulated',
    'pending_manual', 'verified', 'manual_resolved', 'permanent_failed'
  )),
  priority smallint NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_json jsonb,
  last_error_json jsonb,
  error_category text CHECK (error_category IS NULL OR error_category IN (
    'retryable', 'non_retryable', 'configuration', 'internal', 'unknown'
  )),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  simulation_failure_count smallint NOT NULL DEFAULT 0 CHECK (simulation_failure_count >= 0),
  claim_count integer NOT NULL DEFAULT 0 CHECK (claim_count >= 0),
  worker_id text,
  locked_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  original_sendcloud_id text NOT NULL,
  result_sendcloud_id text,
  source_observed_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  planned_at timestamptz,
  applied_at timestamptz,
  simulated_at timestamptz,
  verified_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  recreated_at timestamptz,
  linked_at timestamptz,
  pii_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  pii_redacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auto_fix_jobs_patterns_nonempty CHECK (cardinality(detected_patterns) > 0),
  CONSTRAINT auto_fix_jobs_patterns_known CHECK (detected_patterns <@ ARRAY[
    'currency_chf', 'address_too_long', 'hs_code_missing', 'weight_too_low',
    'service_point_missing', 'sender_eori_missing', 'unknown'
  ]::text[]),
  CONSTRAINT auto_fix_jobs_primary_is_first CHECK (primary_pattern = detected_patterns[1]),
  CONSTRAINT auto_fix_jobs_lock_consistency CHECK (
    (state IN ('claimed', 'planned') AND worker_id IS NOT NULL AND locked_until IS NOT NULL)
    OR state NOT IN ('claimed', 'planned')
  )
);

CREATE TABLE IF NOT EXISTS public.auto_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  job_id uuid REFERENCES public.auto_fix_jobs(id) ON DELETE SET NULL,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  event_key text NOT NULL UNIQUE,
  operation_key text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('simulated', 'live')),
  primary_pattern text NOT NULL CHECK (primary_pattern IN (
    'currency_chf', 'address_too_long', 'hs_code_missing', 'weight_too_low',
    'service_point_missing', 'sender_eori_missing', 'unknown'
  )),
  detected_patterns text[] NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('parcel', 'integration_shipment')),
  source_sendcloud_id text NOT NULL,
  original_sendcloud_id text NOT NULL,
  result_sendcloud_id text,
  action text NOT NULL CHECK (action IN (
    'none', 'put_update', 'create_linked', 'manual_required', 'account_configuration'
  )),
  status text NOT NULL CHECK (status IN (
    'simulated', 'applied', 'verified', 'retry_wait', 'pending_manual',
    'manual_resolved', 'permanent_failed'
  )),
  source_fingerprint text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  error_json jsonb,
  pii_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  pii_redacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auto_fixes_patterns_nonempty CHECK (cardinality(detected_patterns) > 0),
  CONSTRAINT auto_fixes_patterns_known CHECK (detected_patterns <@ ARRAY[
    'currency_chf', 'address_too_long', 'hs_code_missing', 'weight_too_low',
    'service_point_missing', 'sender_eori_missing', 'unknown'
  ]::text[]),
  CONSTRAINT auto_fixes_primary_is_first CHECK (primary_pattern = detected_patterns[1])
);

-- Tables neuves et vides : ces index ne touchent pas shipments (738 MB) et ne
-- necessitent pas CONCURRENTLY. Le futur index/backfill shipments reste une
-- migration operationnelle separee, hors pic et paginee par cle.
CREATE INDEX IF NOT EXISTS idx_auto_fix_jobs_claim_simulated
  ON public.auto_fix_jobs (tenant_id, priority DESC, next_attempt_at, created_at, id)
  WHERE mode = 'simulated' AND state IN ('queued', 'retry_wait', 'claimed', 'planned');
CREATE INDEX IF NOT EXISTS idx_auto_fix_jobs_reclaim_simulated
  ON public.auto_fix_jobs (tenant_id, locked_until, id)
  WHERE mode = 'simulated' AND state IN ('claimed', 'planned');
CREATE INDEX IF NOT EXISTS idx_auto_fix_jobs_shipment
  ON public.auto_fix_jobs (shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auto_fix_jobs_tenant_state_created
  ON public.auto_fix_jobs (tenant_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_fixes_tenant_status_created
  ON public.auto_fixes (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_fixes_job
  ON public.auto_fixes (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auto_fixes_shipment
  ON public.auto_fixes (shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auto_fix_jobs_pii_expiry
  ON public.auto_fix_jobs (pii_expires_at, id)
  WHERE pii_redacted_at IS NULL
    AND state IN ('simulated', 'pending_manual', 'verified', 'manual_resolved', 'permanent_failed');
CREATE INDEX IF NOT EXISTS idx_auto_fixes_pii_expiry
  ON public.auto_fixes (pii_expires_at, id) WHERE pii_redacted_at IS NULL;

ALTER TABLE public.auto_fix_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_fixes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auto_fix_jobs_select ON public.auto_fix_jobs;
CREATE POLICY auto_fix_jobs_select ON public.auto_fix_jobs FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()) OR (SELECT public.is_super_admin()));

DROP POLICY IF EXISTS auto_fixes_select ON public.auto_fixes;
CREATE POLICY auto_fixes_select ON public.auto_fixes FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()) OR (SELECT public.is_super_admin()));

REVOKE ALL ON TABLE public.auto_fix_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.auto_fixes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.auto_fix_jobs, public.auto_fixes TO authenticated;
GRANT SELECT ON TABLE public.auto_fix_jobs, public.auto_fixes TO service_role;

DROP TRIGGER IF EXISTS auto_fix_jobs_updated_at ON public.auto_fix_jobs;
CREATE TRIGGER auto_fix_jobs_updated_at
  BEFORE UPDATE ON public.auto_fix_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    WHERE COALESCE(elem->>'mode', '') <> 'simulated'
  ) THEN
    RAISE EXCEPTION '00093 est dry-run only: mode simulated requis';
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
    WHERE ts.auto_fix_mode = 'simulated'
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

CREATE OR REPLACE FUNCTION public.claim_auto_fix_jobs(
  p_tenant_id uuid,
  p_limit integer DEFAULT 5,
  p_lock_seconds integer DEFAULT 120,
  p_worker_id text DEFAULT NULL
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

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.auto_fix_jobs j
    JOIN public.tenant_settings ts ON ts.tenant_id = j.tenant_id
    WHERE j.tenant_id = p_tenant_id
      AND j.mode = 'simulated'
      AND ts.auto_fix_mode = 'simulated'
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

CREATE OR REPLACE FUNCTION public.get_auto_fix_simulated_tenants(p_limit integer DEFAULT 20)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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
  WHERE ts.auto_fix_mode = 'simulated'
    AND EXISTS (
      SELECT 1
      FROM public.auto_fix_jobs j
      WHERE j.tenant_id = ts.tenant_id
        AND j.mode = 'simulated'
        AND (
          (j.state IN ('queued', 'retry_wait') AND j.next_attempt_at <= now())
          OR (j.state IN ('claimed', 'planned') AND j.locked_until < now())
        )
    )
  ORDER BY ts.tenant_id
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_auto_fix_simulation(
  p_job_id uuid,
  p_worker_id text,
  p_plan jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auto_fix_jobs
  SET state = 'planned', plan_json = COALESCE(p_plan, '{}'::jsonb), planned_at = now(), updated_at = now()
  WHERE id = p_job_id
    AND mode = 'simulated'
    AND state = 'claimed'
    AND worker_id = p_worker_id
    AND locked_until > now();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_auto_fix_simulation(
  p_job_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.auto_fix_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job
  FROM public.auto_fix_jobs
  WHERE id = p_job_id
    AND mode = 'simulated'
    AND state = 'planned'
    AND worker_id = p_worker_id
    AND locked_until > now()
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.auto_fixes (
    tenant_id, job_id, shipment_id, event_key, operation_key, mode,
    primary_pattern, detected_patterns, source_kind, source_sendcloud_id,
    original_sendcloud_id, result_sendcloud_id, action, status,
    source_fingerprint, before_json, after_json
  ) VALUES (
    v_job.tenant_id, v_job.id, v_job.shipment_id,
    v_job.operation_key || ':simulated', v_job.operation_key, v_job.mode,
    v_job.primary_pattern, v_job.detected_patterns, v_job.source_kind,
    v_job.source_sendcloud_id, v_job.original_sendcloud_id, NULL,
    COALESCE(v_job.plan_json->>'action', 'none'), 'simulated',
    v_job.source_fingerprint, v_job.source_summary_json, v_job.plan_json
  )
  ON CONFLICT (event_key) DO NOTHING;

  UPDATE public.auto_fix_jobs
  SET state = 'simulated', simulated_at = now(), resolved_at = now(),
      worker_id = NULL, locked_until = NULL, updated_at = now()
  WHERE id = v_job.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_auto_fix_simulation(
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
  v_failures smallint;
  v_state text;
BEGIN
  SELECT simulation_failure_count + 1 INTO v_failures
  FROM public.auto_fix_jobs
  WHERE id = p_job_id
    AND mode = 'simulated'
    AND state IN ('claimed', 'planned')
    AND worker_id = p_worker_id
    AND locked_until > now()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_owned'; END IF;

  v_state := CASE WHEN v_failures >= 3 THEN 'permanent_failed' ELSE 'retry_wait' END;
  UPDATE public.auto_fix_jobs
  SET state = v_state,
      simulation_failure_count = v_failures,
      last_error_json = COALESCE(p_error, '{}'::jsonb),
      error_category = 'internal',
      next_attempt_at = now() + make_interval(mins => LEAST(60, 5 * (2 ^ (v_failures - 1)))::integer),
      worker_id = NULL,
      locked_until = NULL,
      resolved_at = CASE WHEN v_state = 'permanent_failed' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_job_id;
  RETURN v_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_auto_fix_pii(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_count integer := 0;
  v_job_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 2000 THEN
    RAISE EXCEPTION 'p_limit doit etre entre 1 et 2000';
  END IF;

  WITH candidates AS (
    SELECT id FROM public.auto_fixes
    WHERE pii_redacted_at IS NULL AND pii_expires_at <= now()
    ORDER BY pii_expires_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), scrubbed AS (
    UPDATE public.auto_fixes a
    SET before_json = NULL, after_json = NULL, error_json = NULL, pii_redacted_at = now()
    FROM candidates c WHERE a.id = c.id RETURNING 1
  ) SELECT count(*)::integer INTO v_audit_count FROM scrubbed;

  WITH candidates AS (
    SELECT id FROM public.auto_fix_jobs
    WHERE pii_redacted_at IS NULL
      AND pii_expires_at <= now()
      AND state IN ('simulated', 'pending_manual', 'verified', 'manual_resolved', 'permanent_failed')
    ORDER BY pii_expires_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), scrubbed AS (
    UPDATE public.auto_fix_jobs j
    SET source_summary_json = '{}'::jsonb, plan_json = NULL, last_error_json = NULL,
        pii_redacted_at = now(), updated_at = now()
    FROM candidates c WHERE j.id = c.id RETURNING 1
  ) SELECT count(*)::integer INTO v_job_count FROM scrubbed;

  RETURN v_audit_count + v_job_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_auto_fix_jobs(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_auto_fix_simulated_tenants(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_auto_fix_jobs(uuid, integer, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_auto_fix_simulation(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_auto_fix_simulation(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_auto_fix_simulation(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_auto_fix_pii(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_auto_fix_jobs(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auto_fix_simulated_tenants(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_auto_fix_jobs(uuid, integer, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_auto_fix_simulation(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_auto_fix_simulation(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_auto_fix_simulation(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_auto_fix_pii(integer) TO service_role;

COMMENT ON TABLE public.auto_fix_jobs IS
  'Etat courant idempotent des detections auto-fix. 00093 ne traite que simulated.';
COMMENT ON TABLE public.auto_fixes IS
  'Audit append-only; aucune FK ON DELETE CASCADE. Les JSON PII sont purges apres 30 jours.';
COMMENT ON COLUMN public.auto_fix_jobs.operation_key IS
  'SHA-256 incluant tenant, source, fingerprint, patterns et mode; simulated ne bloque jamais live.';
