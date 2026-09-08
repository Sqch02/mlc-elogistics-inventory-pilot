-- Alerte quand des colis restent bloques en echec d'annonce.
--
-- Un colis en statut 1002 est cree mais n'est jamais parti : le transporteur
-- a refuse l'annonce. Rien ne le signale, et il ne bouge pas tant que
-- personne ne le relance a la main. On ne le decouvre qu'en le cherchant.
--
-- Les 07 et 08/09, 23 colis sont restes ainsi, contre environ un tous les
-- quelques jours en temps normal. Onze etaient suisses, bloques par une
-- devise revenue en francs apres une correction que le moteur croyait
-- reussie (cf 00133 a 00136). Les douze autres portaient un message
-- generique de Sendcloud invitant a reessayer.
--
-- La fenetre est de 48 heures et non de 6 : un colis bloque le reste, et le
-- decouvrir deux jours plus tard vaut mieux que pas du tout.

ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_event_type_check;
ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_event_type_check CHECK (event_type IN (
    'invoice_sent', 'stock_threshold_reached', 'inbound_received',
    'stock_negative_drift', 'auto_fix_manual_backlog', 'blocked_announcements'
  ));

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
      -- Une alerte par client et par tranche de six heures. Relancer des
      -- colis prend du temps ; repeter l'alerte chaque heure apprendrait a
      -- l'ignorer.
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

REVOKE ALL ON FUNCTION public.alert_blocked_announcements(integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_blocked_announcements(integer, interval) TO service_role;

SELECT cron.schedule(
  'blocked-announcements-alert',
  '5 * * * *',
  $$SELECT public.alert_blocked_announcements();$$
);
