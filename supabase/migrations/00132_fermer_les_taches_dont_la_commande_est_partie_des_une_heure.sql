-- Ramener a une heure le delai avant de relire une tache manuelle.
--
-- La migration 00130 attendait 24 h avant de verifier chez Sendcloud si la
-- commande d'une tache manuelle etait partie, par prudence : ne pas fermer
-- une tache que l'exploitant n'a pas encore vue.
--
-- Cette prudence protege de rien. Une commande `fulfilled` a ETE traitee,
-- par definition : l'exploitant l'a expediee, la tache ne decrit plus rien.
-- La garder un jour de plus n'informe personne ; elle fait seulement mentir
-- le tableau pendant une journee. Une tache encore corrigible, elle, n'est
-- pas fermee — seulement horodatee — quel que soit le delai.
--
-- Le cout : la relecture d'une poignee de commandes par heure.

CREATE OR REPLACE FUNCTION public.pending_manual_order_candidates(
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
    AND j.state = 'pending_manual'
    AND j.source_kind = 'integration_shipment'
    AND j.source_order_ref IS NOT NULL
    AND j.write_started_at IS NULL
    AND j.updated_at < now() - interval '1 hour'
  ORDER BY j.updated_at
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;
