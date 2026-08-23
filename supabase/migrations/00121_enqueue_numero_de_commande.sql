-- Le numero de commande n'etait jamais enregistre a la creation d'une tache.
--
-- CE QUI SE PASSAIT
-- La migration 00116 a ajoute `source_order_ref` pour que la tache garde le
-- numero en clair, et la PR #107 a appris au moteur a le lire. Mais personne
-- n'a regarde le maillon du milieu : cette fonction declare explicitement les
-- colonnes qu'elle extrait du JSON, et `source_order_ref` n'y figurait pas.
-- Le code TypeScript envoyait bien la valeur ; `jsonb_to_recordset` la jetait
-- en silence.
--
-- Mesure du 24/08 : sur les 303 taches creees en dix jours, le hachage est
-- renseigne 303 fois et le numero en clair ZERO fois. Les deux viennent
-- pourtant de la meme ligne de code.
--
-- POURQUOI C'EST GRAVE
-- C'est exactement la panne que 00116 devait empecher. Le numero se relit
-- sinon depuis la table des expeditions, et quand cette ligne disparait la
-- tache devient introuvable : ni le moteur ni l'exploitation ne savent de
-- quelle commande il s'agit. Le 07/08, 103 taches etaient dans ce cas. A ce
-- jour, 35 des 41 arbitrages en attente le sont deja.
--
-- Troisieme occurrence du meme piege dans ce moteur : une donnee ajoutee d'un
-- cote, et une liste blanche oubliee de l'autre. Un test verrouille desormais
-- la correspondance entre les champs que le code produit et ceux que cette
-- fonction accepte.

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

-- Rattrapage : figer le numero pour toutes les taches dont la ligne
-- d'expedition existe encore. Celles dont la ligne a deja disparu sont
-- definitivement perdues — c'est precisement ce que la correction empeche
-- desormais.
UPDATE public.auto_fix_jobs j
SET source_order_ref = s.order_ref
FROM public.shipments s
WHERE s.id = j.shipment_id
  AND s.tenant_id = j.tenant_id
  AND j.source_order_ref IS NULL
  AND s.order_ref IS NOT NULL;
