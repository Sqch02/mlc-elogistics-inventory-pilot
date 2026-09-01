-- Colis dont le statut n'a plus bouge depuis longtemps.
--
-- LE CONSTAT, MESURE LE 02/09
-- Quentin signale devoir passer des colis manuellement a « livre » parce
-- qu'ils restent bloques a « Ready to send » chez nous. Verification faite
-- colis par colis sur l'API Sendcloud, sur trois exemplaires de decembre 2025 :
--
--   588437255  Sendcloud dit « Ready to send »  -> jamais scanne, normal
--   595209458  Sendcloud dit « Delivered »      -> perime chez nous depuis le 05/01
--   595210478  Sendcloud dit « Delivered »      -> perime chez nous depuis le 08/01
--
-- Deux sur trois : Sendcloud connaissait le bon statut depuis huit mois et nous
-- ne l'avions jamais repris.
--
-- POURQUOI LA SYNCHRO LES RATE
-- Le cron lit les colis par pages, plafonnees a deux depuis l'incident de
-- saturation du 13/07. Quand le volume de mises a jour depasse ce plafond, les
-- plus anciennes passent a la trappe et ne reviennent jamais : rien ne les
-- rattrape.
--
-- La reconciliation existante ne couvre pas ce cas — elle vise les COMMANDES
-- bloquees « On Hold » sans colis, ce qui est un autre probleme.
--
-- VOLUME
-- Une douzaine par mois en regime courant. Le statut n'affecte ni le stock ni
-- la facturation : tous ces statuts comptent deja pour le stock. L'enjeu est
-- la visibilite, et le travail manuel que Quentin refait a chaque fois.
--
-- BORNES DELIBEREMENT ETROITES
-- Sept jours d'anciennete avant d'etre candidat, sept jours avant d'etre
-- reexamine, et une limite passee par l'appelant. On ne veut pas refaire
-- l'incident du 13/07 en rappelant l'API en masse pour un confort d'affichage.

CREATE OR REPLACE FUNCTION public.stale_parcel_status_candidates(
  p_tenant_id uuid,
  p_limit integer
)
RETURNS TABLE(id uuid, order_ref text, sendcloud_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.id, s.order_ref, s.sendcloud_id
  FROM public.shipments s
  WHERE s.tenant_id = p_tenant_id
    AND s.is_return = false
    -- Un COLIS, pas une commande : l'identifiant d'une commande contient des
    -- tirets, celui d'un colis est numerique.
    AND s.sendcloud_id NOT LIKE '%-%'
    -- Statut non terminal fige : l'etiquette est creee, rien n'a suivi.
    AND s.status_id = 1000
    AND s.shipped_at IS NOT NULL
    AND s.shipped_at < now() - interval '7 days'
    AND (s.reconcile_checked_at IS NULL
         OR s.reconcile_checked_at < now() - interval '7 days')
  ORDER BY s.shipped_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$function$;

REVOKE ALL ON FUNCTION public.stale_parcel_status_candidates(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stale_parcel_status_candidates(uuid, integer) TO service_role;
