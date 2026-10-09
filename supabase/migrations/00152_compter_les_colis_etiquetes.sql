-- Le tableau de bord comptait des commandes comme des expeditions.
--
-- Les lignes de commande (identifiant Sendcloud a tirets, sans statut de
-- transporteur) portent une date d'expedition des leur import : 7 535 sur
-- toute la base le 09/10. mv_dashboard_daily les comptait donc dans les
-- expeditions et, faute de transporteur, dans les tarifs manquants. Chez Florna
-- en octobre : 3 854 « expeditions » pour 3 491 vrais colis (266 commandes On
-- Hold, 89 Unfulfilled, 9 annulees), et 361 « tarifs manquants » qui etaient
-- TOUS des commandes pas encore etiquetees (0 colis reel sans tarif ; 3 sur
-- toute l'histoire). Le correctif 00147 rendant ces chiffres de nouveau
-- visibles, chaque client aurait vu une alerte de milliers de tarifs
-- manquants qui n'existent pas.
--
-- Repere verifie sur toute la base : un vrai colis a TOUJOURS un statut de
-- transporteur (162 208 lignes), une commande JAMAIS (7 535 lignes).
--
-- mv_carrier_daily (00150) recoit le meme filtre : « livraison en point
-- relais », « pending »... sont des methodes de commande, pas des
-- transporteurs.
--
-- Produits et bundles ne changent pas ici : les deux comptent encore les
-- commandes, de la meme facon, et leur rapport reste coherent.

CREATE MATERIALIZED VIEW public.mv_dashboard_daily_colis AS
SELECT tenant_id,
  date(shipped_at) AS day,
  count(*) FILTER (WHERE is_return = false) AS shipments_count,
  count(*) FILTER (WHERE is_return = false AND pricing_status = 'ok'::pricing_status) AS shipments_priced,
  count(*) FILTER (WHERE is_return = false AND pricing_status = 'missing'::pricing_status) AS shipments_missing_pricing,
  COALESCE(sum(computed_cost_eur) FILTER (WHERE is_return = false AND pricing_status = 'ok'::pricing_status), 0::numeric)::numeric(14,2) AS shipments_cost
FROM public.shipments
WHERE shipped_at IS NOT NULL
  AND status_id IS NOT NULL
GROUP BY tenant_id, date(shipped_at);

DROP MATERIALIZED VIEW public.mv_dashboard_daily;
ALTER MATERIALIZED VIEW public.mv_dashboard_daily_colis RENAME TO mv_dashboard_daily;
CREATE UNIQUE INDEX idx_mv_dashboard_daily_pk ON public.mv_dashboard_daily (tenant_id, day);
CREATE INDEX idx_mv_dashboard_daily_recent ON public.mv_dashboard_daily (tenant_id, day DESC);

REVOKE ALL ON public.mv_dashboard_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mv_dashboard_daily TO service_role;

DROP MATERIALIZED VIEW public.mv_carrier_daily;
CREATE MATERIALIZED VIEW public.mv_carrier_daily AS
SELECT s.tenant_id,
  date(s.shipped_at) AS day,
  lower(coalesce(s.carrier, 'unknown')) AS carrier,
  count(*)::bigint AS shipments,
  coalesce(sum(s.computed_cost_eur), 0)::numeric(14,2) AS total_cost
FROM public.shipments s
WHERE s.shipped_at IS NOT NULL
  AND s.is_return = false
  AND s.status_id IS NOT NULL
GROUP BY s.tenant_id, date(s.shipped_at), lower(coalesce(s.carrier, 'unknown'));

CREATE UNIQUE INDEX mv_carrier_daily_cle ON public.mv_carrier_daily (tenant_id, day, carrier);

REVOKE ALL ON public.mv_carrier_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mv_carrier_daily TO service_role;
