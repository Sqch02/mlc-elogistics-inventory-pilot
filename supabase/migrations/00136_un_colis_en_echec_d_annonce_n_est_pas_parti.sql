-- Un colis en echec d'annonce n'est PAS parti.
--
-- La detection livree en 00133 classait « revenue en francs mais deja
-- partie, sans consequence » toute commande que Sendcloud ne dit plus
-- corrigeable. Le raisonnement etait : si le colis est parti, le retour
-- arriere de la devise n'a rien coute.
--
-- Il est faux. Constate le 08/09 : les ONZE colis Delivengo en echec
-- d'annonce des 07 et 08/09 ont tous une conversion de devise marquee
-- `verified`. La commande n'est plus corrigeable parce qu'un colis existe,
-- mais ce colis n'est jamais parti : le transporteur a refuse l'annonce, et
-- le franc revenu est precisement ce qu'il refuse.
--
-- C'etaient donc les cas les PLUS graves, et ils etaient les seuls que la
-- detection ecartait. On remonte desormais l'etat du colis avec le candidat.

-- La signature change : Postgres refuse un REPLACE qui modifie le type de
-- retour, il faut donc supprimer d'abord.
DROP FUNCTION IF EXISTS public.verified_currency_candidates(uuid, integer);

CREATE OR REPLACE FUNCTION public.verified_currency_candidates(
  p_tenant_id uuid,
  p_limit integer
)
RETURNS TABLE(id uuid, source_order_ref text, parcel_blocked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT j.id,
         j.source_order_ref,
         EXISTS (
           SELECT 1 FROM public.shipments s
           WHERE s.tenant_id = j.tenant_id
             AND s.order_ref = j.source_order_ref
             AND s.is_return = false
             AND s.status_id = 1002        -- Announcement failed
         ) AS parcel_blocked
  FROM public.auto_fix_jobs j
  WHERE j.tenant_id = p_tenant_id
    AND j.state = 'verified'
    AND j.primary_pattern = 'currency_chf'
    AND j.source_order_ref IS NOT NULL
    AND j.verified_at > now() - interval '14 days'
    AND j.updated_at < now() - interval '6 hours'
  ORDER BY j.verified_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;

REVOKE ALL ON FUNCTION public.verified_currency_candidates(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verified_currency_candidates(uuid, integer) TO service_role;
