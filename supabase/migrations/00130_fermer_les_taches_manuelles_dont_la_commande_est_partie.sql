-- Refermer les taches manuelles dont la commande est deja partie.
--
-- MESURE DU 03/09
-- 40 des 44 commandes en attente manuelle etaient `fulfilled` chez Sendcloud :
-- l'exploitant les avait corrigees a la main et expediees, et les taches
-- restaient affichees comme du travail a faire. 90 % de la file etait du
-- travail deja fait.
--
-- C'est le trou laisse ouvert le 24/08 : la fermeture par le statut de la
-- COMMANDE avait ete ecartee parce que `shipments.status_message` est du texte
-- libre venu des boutiques. Le statut v3 (`order_details.status.code`), lui,
-- est normalise — `on_hold` / `unfulfilled` sont les seuls corrigeables — et
-- c'est celui que le moteur consulte deja pour rendre `order_not_corrigible`.
-- Mais une tache en `pending_manual` n'est JAMAIS re-examinee par le moteur :
-- ce verdict ne pouvait donc pas la rattraper.
--
-- Cette migration fournit les deux briques cote base ; la lecture v3 se fait
-- cote application (`close-fulfilled.ts`), une commande a la fois, bornee.

-- 1. Les candidates : taches manuelles sur une COMMANDE (pas un colis), avec
--    un numero fige, non re-examinees depuis 24 h. `updated_at` sert de
--    tampon d'examen : la fonction de cloture ci-dessous le pose, et la
--    lecture sans changement le pose aussi (via `touch_auto_fix_job_checked`).
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
    AND j.updated_at < now() - interval '24 hours'
  ORDER BY j.updated_at
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;

-- 2. La cloture : sans objet, avec la raison et le statut lu chez Sendcloud.
CREATE OR REPLACE FUNCTION public.close_auto_fix_job_obsolete(
  p_job_id uuid,
  p_reason text,
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
  SET state = 'obsolete',
      cancelled_at = now(),
      updated_at = now(),
      closure_json = jsonb_build_object(
        'reason', p_reason,
        'detail', p_detail,
        'observed_by', 'close_fulfilled_orders',
        'closed_at', now()
      )
  WHERE id = p_job_id
    AND state = 'pending_manual'
    AND write_started_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$function$;

-- 3. Le tampon d'examen quand la commande est ENCORE corrigeable : on ne la
--    relit pas avant 24 h, sans rien changer d'autre.
CREATE OR REPLACE FUNCTION public.touch_auto_fix_job_checked(p_job_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.auto_fix_jobs SET updated_at = now()
  WHERE id = p_job_id AND state = 'pending_manual';
$function$;

REVOKE ALL ON FUNCTION public.pending_manual_order_candidates(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_auto_fix_job_obsolete(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_auto_fix_job_checked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pending_manual_order_candidates(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_auto_fix_job_obsolete(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_auto_fix_job_checked(uuid) TO service_role;
