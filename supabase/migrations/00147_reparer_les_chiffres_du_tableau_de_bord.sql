-- get_dashboard_metrics echouait a CHAQUE appel depuis le 30/05.
--
-- Le durcissement de securite du 30/05 (garde de client, 00055) l'a reecrite
-- de SQL en PL/pgSQL. Or en PL/pgSQL, les colonnes de sortie d'un RETURNS
-- TABLE (shipments_count, shipments_cost, ...) deviennent des VARIABLES, et la
-- vue lue porte des colonnes du meme nom. Postgres refuse l'ambiguite par
-- defaut :
--
--   42702 column reference "shipments_count" is ambiguous
--
-- La route /api/dashboard ignorait l'erreur : expeditions du mois, cout
-- transport, tarifs manquants, cout d'hier et graphique quotidien affichaient
-- 0, pour tous les clients, pendant plus de quatre mois. Signale par
-- l'exploitant le 09/10.
--
-- Correctif : chaque colonne est prefixee par l'alias de la vue, et le tri se
-- fait par position. La garde de client et les droits sont inchanges.

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_tenant_id uuid,
  p_month_start date,
  p_month_end date,
  p_yesterday date
)
RETURNS TABLE(metric text, day date, shipments_count bigint, shipments_cost numeric, shipments_missing_pricing bigint)
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
  SELECT 'month'::text, NULL::date,
    COALESCE(SUM(d.shipments_count), 0)::bigint,
    COALESCE(SUM(d.shipments_cost), 0)::numeric,
    COALESCE(SUM(d.shipments_missing_pricing), 0)::bigint
  FROM public.mv_dashboard_daily d
  WHERE d.tenant_id = p_tenant_id
    AND d.day >= p_month_start
    AND d.day <= p_month_end
  UNION ALL
  SELECT 'all_time_missing'::text, NULL::date,
    0::bigint, 0::numeric,
    COALESCE(SUM(d.shipments_missing_pricing), 0)::bigint
  FROM public.mv_dashboard_daily d
  WHERE d.tenant_id = p_tenant_id
  UNION ALL
  SELECT 'yesterday'::text, p_yesterday,
    COALESCE(d.shipments_count, 0)::bigint,
    COALESCE(d.shipments_cost, 0)::numeric,
    COALESCE(d.shipments_missing_pricing, 0)::bigint
  FROM public.mv_dashboard_daily d
  WHERE d.tenant_id = p_tenant_id AND d.day = p_yesterday
  UNION ALL
  SELECT 'day'::text, d.day,
    d.shipments_count, d.shipments_cost, d.shipments_missing_pricing
  FROM public.mv_dashboard_daily d
  WHERE d.tenant_id = p_tenant_id
    AND d.day >= p_month_start
    AND d.day <= p_month_end
  ORDER BY 1, 2;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_dashboard_metrics(uuid, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid, date, date, date) TO authenticated, service_role;
