-- Notifications perimees.
--
-- LE SCENARIO QU'ON EVITE. Aucun fournisseur d'envoi n'est encore configure,
-- donc la file se remplit sans se vider. Le jour ou la cle arrivera, le worker
-- enverra TOUT d'un coup — y compris des alertes vieilles de plusieurs jours.
--
-- Or ces messages ne vieillissent pas de la meme facon. Une facture reste
-- pertinente une semaine plus tard : le client la veut, meme en retard. Une
-- alerte de stock de mardi ne veut plus rien dire jeudi — la situation a
-- change, et l'envoyer quand meme apprend au client a ignorer nos alertes.
-- C'est le pire resultat possible pour un systeme d'alerte.
--
-- On annule donc plutot que d'envoyer, et on garde la trace : `cancelled` dit
-- que le message a existe et pourquoi il n'est pas parti.

CREATE OR REPLACE FUNCTION public.cancel_stale_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH perimees AS (
    UPDATE public.notification_outbox
    SET status = 'cancelled',
        last_error = 'perimee : non envoyee dans son delai de pertinence',
        worker_id = NULL,
        locked_until = NULL,
        updated_at = now()
    WHERE status = 'queued'
      AND created_at < now() - CASE event_type
        -- Une facture garde sa valeur meme en retard.
        WHEN 'invoice_sent'            THEN interval '7 days'
        WHEN 'inbound_received'        THEN interval '7 days'
        -- Une alerte de stock decrit un instant : passe deux jours elle ment.
        WHEN 'stock_threshold_reached' THEN interval '2 days'
        WHEN 'stock_negative_drift'    THEN interval '2 days'
        ELSE interval '7 days'
      END
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM perimees;
  RETURN v_count;
END;
$$;

-- La reclamation purge d'abord. Le worker n'a ainsi rien de plus a faire, et
-- aucun chemin ne peut oublier l'etape.
CREATE OR REPLACE FUNCTION public.claim_notifications(
  p_worker_id text,
  p_limit integer DEFAULT 20,
  p_lock_seconds integer DEFAULT 120
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) < 8 THEN
    RAISE EXCEPTION 'p_worker_id requis (8 caracteres minimum)';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit doit etre entre 1 et 100';
  END IF;

  PERFORM public.cancel_stale_notifications();

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.notification_outbox o
    WHERE o.next_attempt_at <= now()
      AND (
        o.status = 'queued'
        OR (o.status = 'sending' AND o.locked_until < now())
      )
    ORDER BY o.next_attempt_at, o.id
    LIMIT p_limit
    FOR UPDATE OF o SKIP LOCKED
  ), claimed AS (
    UPDATE public.notification_outbox o
    SET status = 'sending',
        worker_id = p_worker_id,
        locked_until = now() + make_interval(secs => p_lock_seconds),
        attempt_count = o.attempt_count + 1,
        updated_at = now()
    FROM candidates c
    WHERE o.id = c.id
    RETURNING o.*
  )
  SELECT to_jsonb(claimed.*) FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_stale_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stale_notifications() TO service_role;

COMMENT ON FUNCTION public.cancel_stale_notifications() IS
  'Annule les notifications non envoyees dans leur delai de pertinence. Une alerte de stock perime en 2 jours, une facture en 7.';
