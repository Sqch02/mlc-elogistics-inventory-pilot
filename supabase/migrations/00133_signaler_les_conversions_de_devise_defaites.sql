-- Rendre visibles les conversions de devise defaites apres coup.
--
-- Mesure du 08/09 : sur 60 conversions marquees `verified`, 55 etaient
-- revenues en francs chez Sendcloud. 42 etaient deja parties, le retour
-- arriere est alors sans consequence ; 13 etaient encore ouvertes, et
-- l'exploitant y reverra l'erreur de devise, une par une, sans que rien ne
-- l'annonce.
--
-- Le contraste avec l'adresse est le fait marquant : 25 corrections
-- d'adresse sur 25 tiennent. Ce n'est donc pas la commande entiere qui est
-- reimportee ; seuls les montants reviennent au franc. La cause n'est pas
-- identifiee, et tant qu'elle ne l'est pas on NE REECRIT PAS : on ecrirait
-- en boucle sur les commandes d'un client contre un mecanisme qu'on ne
-- comprend pas. On se contente de signaler.

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
    -- Une commande corrigee il y a longtemps est partie depuis longtemps :
    -- la relire ne servirait qu'a consommer des appels.
    AND j.verified_at > now() - interval '14 days'
    -- Ne pas relire la meme toutes les heures.
    AND j.updated_at < now() - interval '6 hours'
  ORDER BY j.updated_at
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;

-- Signalement, pas correction : la tache repasse en file manuelle avec sa
-- raison, l'exploitant decide.
CREATE OR REPLACE FUNCTION public.flag_auto_fix_currency_regression(
  p_job_id uuid,
  p_detail text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_updated integer;
BEGIN
  UPDATE public.auto_fix_jobs
  SET state = 'pending_manual',
      updated_at = now(),
      last_error_json = jsonb_build_object(
        'reason', 'currency_reverted',
        'category', 'non_retryable',
        'detail', p_detail,
        'observed_by', 'currency_regression_scan',
        'observed_at', now()
      )
  WHERE id = p_job_id
    AND state = 'verified'
    AND primary_pattern = 'currency_chf';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_auto_fix_job_verified(p_job_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.auto_fix_jobs SET updated_at = now()
  WHERE id = p_job_id AND state = 'verified';
$function$;

REVOKE ALL ON FUNCTION public.verified_currency_candidates(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flag_auto_fix_currency_regression(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_auto_fix_job_verified(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verified_currency_candidates(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.flag_auto_fix_currency_regression(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_auto_fix_job_verified(uuid) TO service_role;
