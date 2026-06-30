-- Couche 3 : suggestion automatique de produit pour un libelle non mappe.
-- Combine (a) les mots-cles normalises (signal fort, 0.95) et (b) la similarite
-- floue trigram contre le nom/code des produits (rattrape les fautes de frappe).
-- Utilisee UNIQUEMENT comme suggestion a valider en 1 clic, jamais en
-- auto-deduction.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.suggest_skus_for_label(
  p_tenant_id uuid,
  p_raw_sku text,
  p_raw_description text,
  p_raw_variant_id text
)
 RETURNS TABLE(sku_id uuid, sku_code text, name text, score real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
  WITH norm AS (
    SELECT public.normalize_label(COALESCE(NULLIF(p_raw_description,''), NULLIF(p_raw_sku,''), '')) AS lbl
  ),
  kw AS (
    SELECT sm.target_sku_id AS sid, 0.95::real AS sc
    FROM public.sku_mappings sm, norm
    WHERE sm.tenant_id = p_tenant_id
      AND sm.source = 'description' AND sm.match_type = 'keyword'
      AND norm.lbl IS NOT NULL
      AND norm.lbl LIKE '%' || sm.pattern || '%'
  ),
  trg AS (
    SELECT s.id AS sid,
      GREATEST(
        extensions.similarity(COALESCE((SELECT lbl FROM norm), ''), public.normalize_label(s.name)),
        extensions.similarity(COALESCE((SELECT lbl FROM norm), ''), public.normalize_label(s.sku_code))
      )::real AS sc
    FROM public.skus s
    WHERE s.tenant_id = p_tenant_id AND s.active = true
  ),
  combined AS (
    SELECT sid, MAX(sc) AS sc
    FROM (SELECT * FROM kw UNION ALL SELECT * FROM trg) u
    GROUP BY sid
  )
  SELECT c.sid, s.sku_code, s.name, c.sc
  FROM combined c
  JOIN public.skus s ON s.id = c.sid
  WHERE c.sc >= 0.18
  ORDER BY c.sc DESC
  LIMIT 3;
$function$;

REVOKE EXECUTE ON FUNCTION public.suggest_skus_for_label(uuid, text, text, text) FROM anon, authenticated;
