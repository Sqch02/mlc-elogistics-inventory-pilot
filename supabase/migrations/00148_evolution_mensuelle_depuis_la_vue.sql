-- L'evolution mensuelle du tableau de bord (expeditions et cout par mois)
-- relisait les colis un par un sur douze mois : 4,4 s donnees en memoire,
-- 10,1 s sinon, mesure le 09/10 sur Florna (166 000 colis). Au-dela de 8 s,
-- l'appel est coupe et le graphique reste vide.
--
-- Les memes totaux existent deja jour par jour dans mv_dashboard_daily,
-- rafraichie toutes les 30 minutes. Verifie le 09/10 : un colis sans tarif n'a
-- jamais de cout (9 778 colis, 0 EUR), donc le cout de la vue (colis tarifes)
-- egale la somme d'origine (tous les colis). Les jours sont en UTC, comme le
-- TO_CHAR d'origine dans une session PostgREST.
--
-- Les noms internes (mois, nb, montant) evitent tout conflit avec les colonnes
-- de sortie, piege qui a casse get_dashboard_metrics (00147).

CREATE OR REPLACE FUNCTION public.analytics_monthly_shipments(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE(month text, shipments bigint, cost numeric, claims bigint, indemnity numeric)
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
  SELECT sh.mois, sh.nb, sh.montant,
    COALESCE(cl.nb, 0)::bigint,
    COALESCE(cl.montant, 0)::numeric
  FROM (
    SELECT to_char(d.day, 'YYYY-MM') AS mois,
      SUM(d.shipments_count)::bigint AS nb,
      COALESCE(SUM(d.shipments_cost), 0)::numeric AS montant
    FROM public.mv_dashboard_daily d
    WHERE d.tenant_id = p_tenant_id
      AND d.day >= (p_start_date AT TIME ZONE 'UTC')::date
      AND d.day <= (p_end_date AT TIME ZONE 'UTC')::date
    GROUP BY 1
  ) sh
  LEFT JOIN (
    SELECT to_char(c.decided_at AT TIME ZONE 'UTC', 'YYYY-MM') AS mois,
      COUNT(*)::bigint AS nb,
      COALESCE(SUM(c.indemnity_eur), 0)::numeric AS montant
    FROM public.claims c
    WHERE c.tenant_id = p_tenant_id
      AND c.status = 'indemnisee'
      AND c.decided_at >= p_start_date
      AND c.decided_at <= p_end_date
    GROUP BY 1
  ) cl ON cl.mois = sh.mois
  ORDER BY 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.analytics_monthly_shipments(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analytics_monthly_shipments(uuid, timestamptz, timestamptz) TO authenticated, service_role;
