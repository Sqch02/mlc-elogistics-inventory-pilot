-- Performance par transporteur et volumes de bundles du tableau de bord.
--
-- Mesures du 09/10 sur Florna (166 000 colis sur douze mois) :
--   - get_carrier_performance, 12 mois : 28 s (coupe a 8 s, graphique vide) ;
--   - get_products_metrics : coupe a 8 s quelle que soit la periode, meme un
--     mois. Elle partait des 28 bundles et relisait leurs 138 624 lignes de
--     TOUTE l'histoire, colis par colis, avant de filtrer sur la periode.
--
-- Deux causes, deux corrections :
--   1. La table bundles n'avait JAMAIS ete analysee (19 lignes estimees pour
--      34 reelles, une seule jointure estimee pour 138 803) : le planificateur
--      choisissait la pire methode. ANALYZE la remet d'aplomb.
--   2. Meme bien planifiee, une periode de trois mois relit trop de colis
--      pour tenir en 8 s sur cette instance. Les totaux sont donc precalcules
--      par jour, comme mv_dashboard_daily, dans deux petites vues.
--
-- Les deux vues sont rafraichies par une tache SEPAREE, une fois par heure a
-- :52 (15 s mesurees le 09/10 ; des analyses sur plusieurs mois n'ont pas
-- besoin de plus frais), pour qu'un echec ne bloque jamais le rafraichissement
-- des vues existantes (:07, :37). Les jours sont en UTC, comme
-- mv_dashboard_daily.

ANALYZE public.bundles;

-- 1. Envois et cout par transporteur, par jour.
-- Un colis sans tarif n'a jamais de cout (verifie le 09/10) : la somme de la
-- vue egale celle d'origine sur tous les colis.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_carrier_daily AS
SELECT s.tenant_id,
  date(s.shipped_at) AS day,
  lower(coalesce(s.carrier, 'unknown')) AS carrier,
  count(*)::bigint AS shipments,
  coalesce(sum(s.computed_cost_eur), 0)::numeric(14,2) AS total_cost
FROM public.shipments s
WHERE s.shipped_at IS NOT NULL AND s.is_return = false
GROUP BY s.tenant_id, date(s.shipped_at), lower(coalesce(s.carrier, 'unknown'));

CREATE UNIQUE INDEX IF NOT EXISTS mv_carrier_daily_cle
  ON public.mv_carrier_daily (tenant_id, day, carrier);

-- 2. Quantites de bundles expediees, par jour et par bundle.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_bundle_daily AS
SELECT si.tenant_id,
  date(sh.shipped_at) AS day,
  si.sku_id,
  sum(si.qty)::bigint AS qty
FROM public.shipment_items si
JOIN public.shipments sh ON sh.id = si.shipment_id
WHERE sh.shipped_at IS NOT NULL
  AND sh.is_return = false
  AND EXISTS (
    SELECT 1 FROM public.bundles b
    WHERE b.bundle_sku_id = si.sku_id AND b.tenant_id = si.tenant_id
  )
GROUP BY si.tenant_id, date(sh.shipped_at), si.sku_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_bundle_daily_cle
  ON public.mv_bundle_daily (tenant_id, day, sku_id);

-- Lues uniquement par les fonctions (SECURITY DEFINER), comme les autres vues.
REVOKE ALL ON public.mv_carrier_daily, public.mv_bundle_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mv_carrier_daily, public.mv_bundle_daily TO service_role;

-- 3. Rafraichissement separe.
CREATE OR REPLACE FUNCTION public.refresh_activity_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_carrier_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bundle_daily;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_activity_views() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_activity_views() TO service_role;

SELECT cron.schedule(
  'refresh-activity-views',
  '52 * * * *',
  $$SELECT public.refresh_activity_views()$$
);

-- 4. Performance par transporteur, lue dans la vue. Les reclamations
-- (quelques centaines de lignes) restent calculees en direct.
-- Noms internes en francais et colonnes toutes prefixees : en PL/pgSQL, les
-- colonnes de sortie (carrier, shipments...) sont des variables (cf 00147).
CREATE OR REPLACE FUNCTION public.get_carrier_performance(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE(carrier text, shipments bigint, total_cost numeric, avg_cost numeric, claims bigint, claim_rate numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH envois AS (
    SELECT m.carrier AS transporteur,
      SUM(m.shipments)::bigint AS nb,
      SUM(m.total_cost)::numeric(14,2) AS montant
    FROM public.mv_carrier_daily m
    WHERE m.tenant_id = p_tenant_id
      AND m.day >= (p_start_date AT TIME ZONE 'UTC')::date
      AND m.day <= (p_end_date AT TIME ZONE 'UTC')::date
    GROUP BY m.carrier
  ),
  reclamations AS (
    SELECT lower(coalesce(s.carrier, 'unknown')) AS transporteur,
      COUNT(*)::bigint AS nb
    FROM public.claims c
    JOIN public.shipments s ON s.id = c.shipment_id
    WHERE c.tenant_id = p_tenant_id
      AND c.opened_at >= p_start_date
      AND c.opened_at <= p_end_date
    GROUP BY 1
  )
  SELECT e.transporteur, e.nb, e.montant,
    CASE WHEN e.nb > 0 THEN ROUND((e.montant / e.nb)::numeric, 2) ELSE 0::numeric END,
    COALESCE(r.nb, 0)::bigint,
    CASE WHEN e.nb > 0 THEN ROUND((COALESCE(r.nb, 0)::numeric / e.nb * 100)::numeric, 2) ELSE 0::numeric END
  FROM envois e
  LEFT JOIN reclamations r ON r.transporteur = e.transporteur
  ORDER BY 2 DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_carrier_performance(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_carrier_performance(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- 5. Indicateurs produits : les bundles viennent de la vue ; les produits
-- physiques restent lus dans v_physical_shipment_items (deja precalculee et
-- indexee par client et date, rapide).
--
-- plan_cache_mode = force_custom_plan : apres quelques appels, PL/pgSQL
-- gardait un plan GENERIQUE, calcule sans connaitre les dates, qui relisait
-- toute l'histoire. Avec les vraies dates a chaque appel, un mois passe de
-- 8 s (coupe) a 0,3 s.
CREATE OR REPLACE FUNCTION public.get_products_metrics(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
  v_total_products_volume bigint := 0;
  v_total_bundles_volume bigint := 0;
  v_total_products int := 0;
  v_total_bundles int := 0;
  v_top_products jsonb;
  v_top_bundles jsonb;
  v_monthly jsonb;
  v_debut date := (p_start_date AT TIME ZONE 'UTC')::date;
  v_fin date := (p_end_date AT TIME ZONE 'UTC')::date;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id IS DISTINCT FROM public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden: cannot access tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(SUM(vp.physical_qty), 0)::bigint,
    COUNT(DISTINCT vp.sku_id)::int
  INTO v_total_products_volume, v_total_products
  FROM public.v_physical_shipment_items vp
  WHERE vp.tenant_id = p_tenant_id
    AND vp.is_return = false
    AND vp.shipped_at >= p_start_date
    AND vp.shipped_at <= p_end_date;

  SELECT
    COALESCE(SUM(bd.qty), 0)::bigint,
    COUNT(DISTINCT bd.sku_id)::int
  INTO v_total_bundles_volume, v_total_bundles
  FROM public.mv_bundle_daily bd
  WHERE bd.tenant_id = p_tenant_id
    AND bd.day >= v_debut
    AND bd.day <= v_fin;

  SELECT COALESCE(jsonb_agg(p ORDER BY p.volume DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT vp.sku_id, s.sku_code, s.name, SUM(vp.physical_qty)::bigint AS volume
    FROM public.v_physical_shipment_items vp
    JOIN public.skus s ON s.id = vp.sku_id
    WHERE vp.tenant_id = p_tenant_id
      AND vp.is_return = false
      AND vp.shipped_at >= p_start_date
      AND vp.shipped_at <= p_end_date
    GROUP BY vp.sku_id, s.sku_code, s.name
    ORDER BY SUM(vp.physical_qty) DESC
    LIMIT p_limit
  ) p;

  SELECT COALESCE(jsonb_agg(b ORDER BY b.volume DESC), '[]'::jsonb)
  INTO v_top_bundles
  FROM (
    SELECT bd.sku_id, s.sku_code, s.name, SUM(bd.qty)::bigint AS volume
    FROM public.mv_bundle_daily bd
    JOIN public.skus s ON s.id = bd.sku_id
    WHERE bd.tenant_id = p_tenant_id
      AND bd.day >= v_debut
      AND bd.day <= v_fin
    GROUP BY bd.sku_id, s.sku_code, s.name
    ORDER BY SUM(bd.qty) DESC
    LIMIT p_limit
  ) b;

  WITH products_monthly AS (
    SELECT TO_CHAR(vp.shipped_at, 'YYYY-MM') AS month_key,
      SUM(vp.physical_qty)::bigint AS products
    FROM public.v_physical_shipment_items vp
    WHERE vp.tenant_id = p_tenant_id
      AND vp.is_return = false
      AND vp.shipped_at >= p_start_date
      AND vp.shipped_at <= p_end_date
    GROUP BY TO_CHAR(vp.shipped_at, 'YYYY-MM')
  ),
  bundles_monthly AS (
    SELECT TO_CHAR(bd.day, 'YYYY-MM') AS month_key,
      SUM(bd.qty)::bigint AS bundles
    FROM public.mv_bundle_daily bd
    WHERE bd.tenant_id = p_tenant_id
      AND bd.day >= v_debut
      AND bd.day <= v_fin
    GROUP BY TO_CHAR(bd.day, 'YYYY-MM')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', COALESCE(pm.month_key, bm.month_key),
    'products', COALESCE(pm.products, 0),
    'bundles', COALESCE(bm.bundles, 0)
  )), '[]'::jsonb)
  INTO v_monthly
  FROM products_monthly pm
  FULL OUTER JOIN bundles_monthly bm ON pm.month_key = bm.month_key;

  RETURN jsonb_build_object(
    'topProducts', v_top_products,
    'topBundles', v_top_bundles,
    'monthlyVolumes', v_monthly,
    'summary', jsonb_build_object(
      'totalProducts', v_total_products,
      'totalBundles', v_total_bundles,
      'totalProductsVolume', v_total_products_volume,
      'totalBundlesVolume', v_total_bundles_volume
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_products_metrics(uuid, timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_products_metrics(uuid, timestamptz, timestamptz, integer) TO authenticated, service_role;
