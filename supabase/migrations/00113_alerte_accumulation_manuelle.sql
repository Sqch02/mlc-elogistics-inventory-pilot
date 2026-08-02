-- Alerte quand les corrections manuelles s'accumulent.
--
-- Le systeme corrige seul ce qu'il sait corriger et renvoie le reste a
-- l'exploitation. Tant que ce reste est faible, tout va bien. S'il enfle
-- brutalement, quelque chose a change — une regle Sendcloud, un transporteur,
-- un flux boutique — et personne ne le saurait avant que quelqu'un ne trouve
-- sa soiree anormalement longue.
--
-- ON COMPTE DES COMMANDES DISTINCTES, PAS DES LIGNES. Une meme commande peut
-- produire plusieurs taches (adresse trop longue ET devise) ; les compter
-- separement declencherait l'alerte deux fois plus vite, pour un volume de
-- travail identique.

ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_event_type_check;
ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_event_type_check CHECK (event_type IN (
    'invoice_sent', 'stock_threshold_reached', 'inbound_received',
    'stock_negative_drift', 'auto_fix_manual_backlog'
  ));

CREATE OR REPLACE FUNCTION public.alert_auto_fix_manual_backlog(
  p_threshold integer DEFAULT 5,
  p_window interval DEFAULT interval '6 hours'
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
    SELECT j.tenant_id,
           count(DISTINCT j.shipment_id) AS commandes,
           string_agg(DISTINCT j.primary_pattern, ', ') AS motifs
    FROM public.auto_fix_jobs j
    WHERE j.state = 'pending_manual'
      AND j.updated_at > now() - p_window
      AND j.shipment_id IS NOT NULL
      -- Un colis deja parti n'est corrigeable par personne : le compter
      -- ferait sonner l'alerte pour du travail qui n'existe pas.
      AND COALESCE(j.last_error_json->>'reason', '') <> 'parcel_not_editable'
    GROUP BY j.tenant_id
    HAVING count(DISTINCT j.shipment_id) >= p_threshold
  LOOP
    SELECT value INTO v_recipient FROM public.app_config WHERE key = 'notification_team_cc';
    IF v_recipient IS NULL OR trim(v_recipient) = '' THEN CONTINUE; END IF;

    INSERT INTO public.notification_outbox (
      tenant_id, idempotency_key, event_type, entity_id,
      recipient, cc, subject, payload
    ) VALUES (
      v_tenant.tenant_id,
      -- Une alerte par client et par tranche de six heures : le probleme met
      -- des heures a se resoudre, repeter l'alerte toutes les dix minutes ne
      -- ferait qu'apprendre a l'ignorer.
      'manual_backlog:' || v_tenant.tenant_id::text || ':'
        || to_char(date_trunc('hour', now()) - make_interval(hours => EXTRACT(hour FROM now())::integer % 6), 'YYYY-MM-DD-HH24'),
      'auto_fix_manual_backlog',
      NULL,
      trim(v_recipient),
      ARRAY[]::text[],
      'Corrections manuelles en hausse : '
        || (SELECT name FROM public.tenants WHERE id = v_tenant.tenant_id),
      jsonb_build_object(
        'tenant_id', v_tenant.tenant_id,
        'orders', v_tenant.commandes,
        'threshold', p_threshold,
        'window_hours', EXTRACT(epoch FROM p_window) / 3600,
        'patterns', v_tenant.motifs
      )
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    IF FOUND THEN v_alertes := v_alertes + 1; END IF;
  END LOOP;

  RETURN v_alertes;
END;
$$;

REVOKE ALL ON FUNCTION public.alert_auto_fix_manual_backlog(integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_auto_fix_manual_backlog(integer, interval) TO service_role;

SELECT cron.schedule(
  'auto-fix-manual-backlog-alert',
  '25 * * * *',
  $$SELECT public.alert_auto_fix_manual_backlog();$$
);
