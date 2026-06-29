-- Couche 1 (suite) : matching automatique par mots-cles normalises.
-- Nouveau match_type 'keyword' : le pattern est un mot-cle deja normalise,
-- cherche dans le libelle normalise. Garde anti-ambiguite : on ne resout que
-- si UN SEUL produit distinct matche (sinon -> NULL -> file a valider, jamais
-- de mauvaise deduction).

ALTER TABLE public.sku_mappings DROP CONSTRAINT IF EXISTS sku_mappings_match_type_check;
ALTER TABLE public.sku_mappings ADD CONSTRAINT sku_mappings_match_type_check
  CHECK (match_type = ANY (ARRAY['exact'::text, 'ilike'::text, 'contains'::text, 'keyword'::text]));

CREATE OR REPLACE FUNCTION public.map_shipment_item(p_tenant_id uuid, p_raw_sku text, p_raw_description text, p_raw_variant_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sku_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  IF p_raw_sku IS NOT NULL AND p_raw_sku != '' THEN
    SELECT id INTO v_sku_id FROM skus WHERE tenant_id = p_tenant_id AND sku_code = p_raw_sku LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
    SELECT id INTO v_sku_id FROM skus WHERE tenant_id = p_tenant_id AND LOWER(TRIM(sku_code)) = LOWER(TRIM(p_raw_sku)) LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  IF p_raw_variant_id IS NOT NULL AND p_raw_variant_id != '' THEN
    SELECT id INTO v_sku_id FROM skus WHERE tenant_id = p_tenant_id AND shopify_variant_id = p_raw_variant_id LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  IF p_raw_variant_id IS NOT NULL AND p_raw_variant_id != '' THEN
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings
    WHERE tenant_id = p_tenant_id AND source = 'variant_id' AND pattern = p_raw_variant_id LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  IF p_raw_sku IS NOT NULL AND p_raw_sku != '' THEN
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings
    WHERE tenant_id = p_tenant_id AND source = 'sku_alias'
    AND ((match_type = 'exact' AND pattern = p_raw_sku) OR (match_type = 'ilike' AND LOWER(pattern) = LOWER(p_raw_sku)))
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  IF p_raw_description IS NOT NULL AND p_raw_description != '' THEN
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings
    WHERE tenant_id = p_tenant_id AND source = 'description'
    AND (
      (match_type = 'exact' AND pattern = p_raw_description) OR
      (match_type = 'ilike' AND LOWER(p_raw_description) LIKE LOWER(pattern)) OR
      (match_type = 'contains' AND LOWER(p_raw_description) LIKE '%' || LOWER(pattern) || '%')
    )
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;

    WITH matches AS (
      SELECT DISTINCT sm.target_sku_id AS tid
      FROM sku_mappings sm
      WHERE sm.tenant_id = p_tenant_id
        AND sm.source = 'description'
        AND sm.match_type = 'keyword'
        AND public.normalize_label(p_raw_description) LIKE '%' || sm.pattern || '%'
    )
    SELECT (array_agg(tid))[1] INTO v_sku_id
    FROM matches
    HAVING count(*) = 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;

  RETURN NULL;
END;
$function$;

-- Mots-cles Florna. Inseres avec le trigger de remap DESACTIVE pour ne PAS
-- declencher le rattrapage retroactif (fait separement, sous controle).
ALTER TABLE public.sku_mappings DISABLE TRIGGER remap_on_mapping_insert;

INSERT INTO public.sku_mappings (tenant_id, source, match_type, pattern, target_sku_id)
SELECT 'f1073a00-0000-4000-a000-000000000001'::uuid, 'description', 'keyword', kw.pattern, s.id
FROM (VALUES
  ('perte de poids','FLRN-PPOIDS-FBCG'),
  ('coupe faim','FLRN-COFAIM-FBCG'),
  ('sommeil','FLRN-SOMMEI-FBCG'),
  ('bague','FLRN-BAGUEM-1UNI'),
  ('anxiete','FLRN-ANXIET-FBCG'),
  ('stress','FLRN-ANXIET-FBCG'),
  ('energie','FLRN-ENERG-FBCG'),
  ('menopause','FLRN-MENOPA-FBCG'),
  ('digestion','FLRN-DIGEST-FBCG'),
  ('articulation','FLRN-ARTICU-FBCG'),
  ('mobilite','FLRN-ARTICU-FBCG')
) AS kw(pattern, sku_code)
JOIN public.skus s ON s.sku_code = kw.sku_code AND s.tenant_id = 'f1073a00-0000-4000-a000-000000000001'::uuid
ON CONFLICT (tenant_id, source, pattern) DO NOTHING;

ALTER TABLE public.sku_mappings ENABLE TRIGGER remap_on_mapping_insert;
