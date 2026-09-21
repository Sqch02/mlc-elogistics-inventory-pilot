-- Une seule tache manuelle par commande et par motif.
--
-- Releve le 21/09 : 18 taches en file manuelle pour 15 commandes. La
-- commande #564722 en portait trois a elle seule, detectee le 19 en erreur
-- latente puis deux fois le 21 apres l'echec d'annonce. Meme commande, meme
-- motif, meme travail : l'exploitant voyait trois lignes.
--
-- La cle d'operation dedoublonne une meme detection, pas une redetection
-- dans un contexte different. On ajoute donc la garde qui manquait, sans
-- toucher au reste de la fonction.

CREATE OR REPLACE FUNCTION public.enqueue_auto_fix_jobs(p_jobs jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      source_order_ref text,
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
      source_order_ref,
      source_fingerprint, primary_pattern, detected_patterns, mode, operation_key,
      priority, evidence_json, source_summary_json, original_sendcloud_id,
      source_observed_at
    )
    SELECT
      i.tenant_id, i.shipment_id, i.source_kind, i.source_sendcloud_id, i.source_order_ref_hash,
      i.source_order_ref,
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
    WHERE ts.auto_fix_mode = i.mode
      -- Une seule tache manuelle par commande et par motif.
      --
      -- La cle d'operation dedoublonne une MEME detection. Elle ne dit rien
      -- quand la meme commande est redetectee dans un contexte different :
      -- la commande #564722 a ainsi produit trois taches en deux jours, une
      -- en erreur latente puis deux apres l'echec d'annonce. L'exploitant
      -- voyait trois fois la meme ligne a traiter.
      --
      -- On ne bloque que si une tache est DEJA devant lui, sur la meme
      -- commande et le meme motif. Une tache close ne bloque rien : une
      -- erreur qui revient doit pouvoir etre redetectee.
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_fix_jobs ouverte
        WHERE ouverte.tenant_id = i.tenant_id
          AND ouverte.source_order_ref IS NOT NULL
          AND ouverte.source_order_ref = i.source_order_ref
          AND ouverte.primary_pattern = i.primary_pattern
          AND ouverte.state = 'pending_manual'
          -- La meme cle doit continuer de passer, sinon la tache existante
          -- ne serait plus rafraichie par ON CONFLICT.
          AND ouverte.operation_key <> i.operation_key
      )
    ON CONFLICT (operation_key) DO UPDATE SET
      last_seen_at = now(),
      source_observed_at = GREATEST(auto_fix_jobs.source_observed_at, EXCLUDED.source_observed_at),
      shipment_id = COALESCE(auto_fix_jobs.shipment_id, EXCLUDED.shipment_id),
      -- Une tache ancienne recuperera son numero au prochain passage, sans
      -- jamais ecraser celui qui est deja fige.
      source_order_ref = COALESCE(auto_fix_jobs.source_order_ref, EXCLUDED.source_order_ref)
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM upserted;
  RETURN v_count;
END;
$function$;
