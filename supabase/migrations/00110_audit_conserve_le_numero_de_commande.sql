-- L'audit doit conserver le numero de commande.
--
-- LE DEFAUT. Le tableau de bord retrouvait le numero par jointure sur la table
-- des expeditions. Or quand une commande importee devient un colis, sa ligne
-- d'origine est remplacee : le lien casse, et le numero disparait.
--
-- Il disparait donc exactement pour les commandes EXPEDIEES — precisement
-- celles qu'on voudrait pouvoir auditer apres coup, quand un client demande
-- pourquoi son adresse a change. Verifie en production : sur onze corrections,
-- huit avaient deja perdu leur numero.
--
-- On l'inscrit donc dans l'audit au moment de l'ecriture. Ce n'est pas
-- contradictoire avec le choix de ne PAS le stocker dans la file : la file est
-- un etat de travail transitoire et ne retient qu'une empreinte, tandis que
-- `auto_fixes` EST la trace, avec sa propre retention. Un numero de commande
-- n'est d'ailleurs pas une donnee personnelle mais une reference commerciale :
-- il n'entre pas dans la purge, sans quoi la trace perdrait son seul point
-- d'entree lisible.

ALTER TABLE public.auto_fixes
  ADD COLUMN IF NOT EXISTS source_order_ref text;

COMMENT ON COLUMN public.auto_fixes.source_order_ref IS
  'Numero de commande au moment de la correction. Survit au remplacement de la ligne d''expedition. Hors purge PII : c''est une reference commerciale.';

CREATE OR REPLACE FUNCTION public.mark_auto_fix_applied(
  p_job_id uuid,
  p_worker_id text,
  p_result_sendcloud_id text,
  p_before jsonb,
  p_after jsonb,
  p_order_ref text DEFAULT NULL
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
    source_fingerprint, before_json, after_json, source_order_ref
  ) VALUES (
    v_job.tenant_id, v_job.id, v_job.shipment_id,
    v_job.operation_key || ':applied', v_job.operation_key, v_job.mode,
    v_job.primary_pattern, v_job.detected_patterns, v_job.source_kind,
    v_job.source_sendcloud_id, v_job.original_sendcloud_id,
    COALESCE(p_result_sendcloud_id, v_job.original_sendcloud_id),
    CASE WHEN v_job.source_kind = 'parcel' THEN 'put_update' ELSE 'patch_order_v3' END,
    'applied', v_job.source_fingerprint, p_before, p_after,
    -- A defaut de numero fourni, on tente encore la jointure : elle fonctionne
    -- tant que la commande n'a pas ete remplacee.
    COALESCE(p_order_ref, (
      SELECT s.order_ref FROM public.shipments s WHERE s.id = v_job.shipment_id
    ))
  )
  ON CONFLICT (event_key) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_auto_fix_applied(uuid, text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_auto_fix_applied(uuid, text, text, jsonb, jsonb, text) TO service_role;

-- Rattrapage : les corrections dont la commande existe encore recuperent leur
-- numero. Celles dont la ligne a disparu resteront sans, c'est irrattrapable.
UPDATE public.auto_fixes a
SET source_order_ref = s.order_ref
FROM public.shipments s
WHERE a.source_order_ref IS NULL
  AND s.id = a.shipment_id
  AND s.order_ref IS NOT NULL;
