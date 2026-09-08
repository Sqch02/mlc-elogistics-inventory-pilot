-- Un echec d'annonce suivi d'un succes n'est pas un blocage.
--
-- L'alerte posee en 00137 comptait tout colis en statut 1002. Elle a sonne
-- le 08/09 pour 23 colis. L'exploitant a verifie : les 23 commandes etaient
-- parties. Verification faite ensuite chez Sendcloud, commande par commande :
-- les 20 commandes concernees ont TOUTES un colis reellement expedie, avec
-- son numero de suivi.
--
-- La plateforme cree un colis, l'annonce echoue, elle en recree un aussitot
-- et celui-la part. Les deux existent, a la meme minute. Le premier reste
-- affiche en echec pour toujours : c'est un residu, pas un probleme.
--
-- L'alerte ne doit donc sonner que si AUCUN colis de la commande n'est parti.
-- Une alerte qui se trompe apprend a etre ignoree, et coute plus cher que
-- l'absence d'alerte.

CREATE OR REPLACE FUNCTION public.alert_blocked_announcements(
  p_threshold integer DEFAULT 3,
  p_window interval DEFAULT interval '48 hours'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant record;
  v_recipient text;
  v_alertes integer := 0;
BEGIN
  FOR v_tenant IN
    SELECT s.tenant_id,
           count(*) AS colis,
           string_agg(DISTINCT s.carrier, ', ') AS transporteurs
    FROM public.shipments s
    WHERE s.status_id = 1002
      AND s.is_return = false
      AND s.shipped_at > now() - p_window
      -- Aucun autre colis de la meme commande n'a reussi a partir.
      AND NOT EXISTS (
        SELECT 1 FROM public.shipments jumeau
        WHERE jumeau.tenant_id = s.tenant_id
          AND jumeau.order_ref = s.order_ref
          AND jumeau.order_ref IS NOT NULL
          AND jumeau.is_return = false
          AND jumeau.id <> s.id
          AND jumeau.status_id <> 1002
      )
    GROUP BY s.tenant_id
    HAVING count(*) >= p_threshold
  LOOP
    SELECT value INTO v_recipient FROM public.app_config WHERE key = 'notification_team_cc';
    IF v_recipient IS NULL OR trim(v_recipient) = '' THEN CONTINUE; END IF;

    INSERT INTO public.notification_outbox (
      tenant_id, idempotency_key, event_type, entity_id,
      recipient, cc, subject, payload
    ) VALUES (
      v_tenant.tenant_id,
      'blocked_announcements:' || v_tenant.tenant_id::text || ':'
        || to_char(date_trunc('hour', now()) - make_interval(hours => EXTRACT(hour FROM now())::integer % 6), 'YYYY-MM-DD-HH24'),
      'blocked_announcements',
      NULL,
      trim(v_recipient),
      ARRAY[]::text[],
      'Colis bloques en echec d''annonce : '
        || (SELECT name FROM public.tenants WHERE id = v_tenant.tenant_id),
      jsonb_build_object(
        'tenant_id', v_tenant.tenant_id,
        'parcels', v_tenant.colis,
        'threshold', p_threshold,
        'window_hours', EXTRACT(epoch FROM p_window) / 3600,
        'carriers', v_tenant.transporteurs
      )
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    IF FOUND THEN v_alertes := v_alertes + 1; END IF;
  END LOOP;

  RETURN v_alertes;
END;
$$;
