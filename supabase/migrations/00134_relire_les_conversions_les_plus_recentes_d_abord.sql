-- Relire les conversions les plus RECENTES d'abord.
--
-- La migration 00133 triait par `updated_at` croissant, donc les plus
-- anciennes en premier. Simulation du 08/09 sur 100 candidates : 100 revenues
-- en francs, et 100 deja parties. Zero signalement utile.
--
-- C'est logique : une conversion ancienne porte sur une commande partie
-- depuis longtemps, dont le retour arriere ne coute rien. Celles qu'il faut
-- rattraper sont les RECENTES, encore ouvertes, ou l'exploitant reverra
-- l'erreur avant de faire l'etiquette.
--
-- Meme piege que les checkpoints du 26/07 : un tri qui eloigne du present
-- fait travailler le balayage sur ce qui n'a plus d'importance.

CREATE OR REPLACE FUNCTION public.verified_currency_candidates(
  p_tenant_id uuid,
  p_limit integer
)
RETURNS TABLE(id uuid, source_order_ref text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT j.id, j.source_order_ref
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
