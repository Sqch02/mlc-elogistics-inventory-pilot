-- Refermer une tache dont la commande n'est plus identifiable par personne.
--
-- LE MECANISME, ETABLI ET NON SUPPOSE
-- Le cron de synchronisation supprime deliberement les lignes de commande
-- devenues des colis. Dans `src/app/api/sync/sendcloud/cron/route.ts` :
-- il releve les numeros des colis nouvellement synchronises, cherche les
-- lignes portant le meme numero dont l'identifiant est un UUID (donc une
-- commande, pas un colis), et les supprime -- « old UUID records that became
-- parcels ».
--
-- Une tache accrochee a une commande devient donc orpheline AU MOMENT PRECIS
-- OU LA COMMANDE PART. Elle ne gardait jusqu'ici que l'empreinte du numero,
-- inexploitable : ni le moteur ni l'exploitation ne peuvent dire de quelle
-- commande il s'agit.
--
-- MESURE DU 24/08
-- 42 des 51 taches de la file manuelle -- 82 % -- etaient dans ce cas. Aucune
-- n'est retrouvable : ni par le lien d'expedition, ni par l'identifiant
-- Sendcloud. Elles sont, par construction, du travail que personne ne peut
-- faire. Et puisque leur ligne n'a ete supprimee qu'apres creation du colis,
-- la marchandise etait deja partie.
--
-- POURQUOI UNE REGLE ET NON UN COUP DE BALAI
-- La migration 00121 corrige la cause : le numero est desormais fige a la
-- creation de la tache et survit a la suppression de la ligne. Une tache creee
-- a partir de maintenant restera donc toujours identifiable, et cette regle ne
-- l'atteindra jamais -- elle exige `source_order_ref IS NULL`. Elle ne traite
-- que le residu d'avant, y compris celui qui remontera plus tard.
--
-- C'est la troisieme sortie donnee a cette file (00115, 00119, celle-ci). A
-- chaque fois la meme question : cette ligne demande-t-elle un travail qui
-- existe encore, et quelqu'un peut-il seulement le faire ?

CREATE OR REPLACE FUNCTION public.close_unidentifiable_auto_fix_jobs(p_limit integer DEFAULT 500)
RETURNS TABLE(closed integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_closed integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 5000 THEN
    p_limit := 500;
  END IF;

  WITH candidates AS (
    SELECT j.id
    FROM public.auto_fix_jobs j
    WHERE j.state = 'pending_manual'
      AND j.source_kind = 'integration_shipment'
      -- Le numero fige rend la tache exploitable : on n'y touche jamais.
      AND j.source_order_ref IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.shipments s WHERE s.id = j.shipment_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.shipments s2
        WHERE s2.tenant_id = j.tenant_id
          AND s2.sendcloud_id = j.source_sendcloud_id
      )
    ORDER BY j.created_at
    LIMIT p_limit
    FOR UPDATE OF j SKIP LOCKED
  ), updated AS (
    UPDATE public.auto_fix_jobs j
    SET state = 'obsolete',
        cancelled_at = now(),
        updated_at = now(),
        closure_json = jsonb_build_object(
          'reason', 'order_row_deleted_after_parcel_created',
          'detail', 'ligne de commande supprimee par le nettoyage des doublons du cron une fois le colis cree ; numero non fige avant la migration 00121',
          'observed_by', 'close_unidentifiable_auto_fix_jobs',
          'closed_at', now()
        )
    FROM candidates c
    WHERE j.id = c.id
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_closed FROM updated;

  RETURN QUERY
  SELECT v_closed,
         (SELECT count(*)::integer FROM public.auto_fix_jobs WHERE state = 'pending_manual');
END;
$function$;

REVOKE ALL ON FUNCTION public.close_unidentifiable_auto_fix_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_unidentifiable_auto_fix_jobs(integer) TO service_role;

-- Meme cadence que le balayage existant, decale pour ne pas se chevaucher.
SELECT cron.schedule(
  'auto-fix-close-unidentifiable',
  '50 * * * *',
  $$SELECT public.close_unidentifiable_auto_fix_jobs(500)$$
);
