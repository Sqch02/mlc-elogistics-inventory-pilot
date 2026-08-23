-- Refermer une tache manuelle dont la commande est partie par un AUTRE colis.
--
-- CE QUE LE BALAYAGE MANQUAIT
-- La migration 00115 a donne une sortie a la file manuelle : une tache dont le
-- colis n'est plus corrigeable est refermee. Elle ecarte volontairement le
-- statut 1002 (« echec d'annonce »), et ce choix est juste pris isolement :
-- un colis dont l'annonce a echoue est precisement celui qu'on peut encore
-- reparer.
--
-- Il devient faux des qu'on regarde la COMMANDE. Quand l'annonce echoue,
-- l'exploitant ne repare pas toujours le colis : souvent il en recree un, qui
-- part normalement. La marchandise est alors sortie, et la tache accrochee au
-- colis en echec reclame un travail qui n'existe plus.
--
-- MESURE DU 24/08
-- 12 taches sur les 65 de la file, soit 18 %, etaient dans ce cas. Les douze
-- commandes correspondantes ont ete relues une par une sur l'API Sendcloud :
-- les douze sont `fulfilled`. Aucune n'attendait quoi que ce soit.
--
-- C'est la meme erreur que celle du 07/08, d'un cran plus loin : une file qui
-- se remplit de travail deja fait finit par etre ignoree en bloc, et les
-- vraies corrections se perdent avec le reste.
--
-- LE GARDE-FOU
-- Une commande peut legitimement partir en deux colis, l'un annonce et l'autre
-- encore a corriger. On exige donc que l'echec ait plus de 48 heures : le cas
-- ou deux colis d'une meme commande sont en vol le meme jour n'est jamais
-- touche. Les douze cas mesures passent tous ce delai (le plus recent datait
-- de sept jours).
--
-- La raison de fermeture est distincte de celle de 00115, et le colis frere
-- est inscrit dans `closure_json` : une fermeture peut ainsi etre relue, et
-- annulee a la main si elle s'averait fausse.

CREATE OR REPLACE FUNCTION public.close_obsolete_auto_fix_jobs(p_limit integer DEFAULT 500)
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
    SELECT j.id,
           s.status_id,
           s.status_message,
           CASE
             WHEN s.status_id IS NOT NULL AND s.status_id NOT IN (1000, 1002)
               THEN 'parcel_no_longer_correctable'
             ELSE 'order_shipped_by_another_parcel'
           END AS reason,
           (
             SELECT autre.sendcloud_id
             FROM public.shipments autre
             WHERE autre.tenant_id = s.tenant_id
               AND autre.order_ref = s.order_ref
               AND autre.id <> s.id
               AND autre.date_announced IS NOT NULL
             ORDER BY autre.date_announced DESC
             LIMIT 1
           ) AS colis_parti
    FROM public.auto_fix_jobs j
    JOIN public.shipments s
      ON s.sendcloud_id::text = j.source_sendcloud_id
     AND s.tenant_id = j.tenant_id
    WHERE j.state = 'pending_manual'
      AND j.source_kind = 'parcel'
      AND (
        -- Cas d'origine (00115) : le colis lui-meme n'est plus corrigeable.
        (
          s.date_announced IS NOT NULL
          AND s.status_id IS NOT NULL
          AND s.status_id NOT IN (1000, 1002)
        )
        -- Cas ajoute : l'annonce a echoue, mais la commande est partie par un
        -- autre colis. On exige 48 heures pour ne jamais toucher une commande
        -- dont les colis sont encore en cours de traitement.
        OR (
          s.status_id = 1002
          AND s.date_announced IS NULL
          AND s.order_ref IS NOT NULL
          AND s.created_at < now() - interval '48 hours'
          AND EXISTS (
            SELECT 1
            FROM public.shipments autre
            WHERE autre.tenant_id = s.tenant_id
              AND autre.order_ref = s.order_ref
              AND autre.id <> s.id
              AND autre.date_announced IS NOT NULL
          )
        )
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
          'reason', c.reason,
          'status_id', c.status_id,
          'status_message', c.status_message,
          'shipped_by_parcel', c.colis_parti,
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
