-- Outbox de notifications.
--
-- FILE ONLY : cette migration cree l'infrastructure, elle n'envoie rien. Aucun
-- fournisseur d'envoi n'est configure, et le worker refuse de partir sans.
--
-- POURQUOI UN OUTBOX ET PAS UN ENVOI DIRECT
-- Configurer un SMTP ne fournit pas un mailer applicatif. Si l'envoi est fait
-- en ligne dans la requete metier, deux choses cassent : un fournisseur
-- indisponible fait echouer la facture elle-meme, et un rejeu de la requete
-- renvoie l'email une seconde fois.
-- L'evenement est donc insere dans la MEME transaction que la mutation metier
-- -- si la facture n'est pas passee a "envoyee", aucune notification n'existe --
-- et l'envoi, lui, est asynchrone : son echec ne peut plus rien annuler.

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Cle d'idempotence : un evenement metier + un destinataire = un seul envoi,
  -- quel que soit le nombre de rejeux.
  idempotency_key text NOT NULL UNIQUE,

  event_type text NOT NULL CHECK (event_type IN (
    'invoice_sent', 'stock_threshold_reached', 'inbound_received'
  )),
  entity_id uuid,

  recipient text NOT NULL CHECK (recipient ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  cc text[] NOT NULL DEFAULT ARRAY[]::text[],
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'sending', 'sent', 'failed', 'cancelled'
  )),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  worker_id text,

  provider text,
  provider_message_id text,
  last_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notification_outbox_lock_consistency CHECK (
    (status = 'sending' AND worker_id IS NOT NULL AND locked_until IS NOT NULL)
    OR status <> 'sending'
  ),
  CONSTRAINT notification_outbox_sent_is_traced CHECK (
    status <> 'sent' OR sent_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_due
  ON public.notification_outbox (next_attempt_at, id)
  WHERE status IN ('queued', 'sending');

CREATE INDEX IF NOT EXISTS idx_notification_outbox_tenant_created
  ON public.notification_outbox (tenant_id, created_at DESC);

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox FORCE ROW LEVEL SECURITY;

-- Etat interne : la file contient des adresses clients, aucun acces direct.
REVOKE ALL ON TABLE public.notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_outbox TO service_role;

DROP TRIGGER IF EXISTS notification_outbox_updated_at ON public.notification_outbox;
CREATE TRIGGER notification_outbox_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Destinataires par tenant
-- ---------------------------------------------------------------------------
-- Un destinataire distinct par nature de notification : la facturation et les
-- alertes de stock ne vont pas forcement a la meme personne.

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS invoice_email text,
  ADD COLUMN IF NOT EXISTS stock_alert_email text,
  ADD COLUMN IF NOT EXISTS inbound_email text;

COMMENT ON COLUMN public.tenant_settings.invoice_email IS
  'Destinataire des factures. NULL = aucune notification pour ce tenant.';

-- ---------------------------------------------------------------------------
-- Passage d'une facture a "envoyee", AVEC la notification, atomiquement
-- ---------------------------------------------------------------------------
-- C'est le point de la conception : si la transition echoue, aucune
-- notification n'existe ; si la notification ne peut pas etre inserée, la
-- transition n'a pas lieu. L'envoi, lui, viendra apres et pourra echouer sans
-- rien annuler.
--
-- Le declencheur est la TRANSITION draft -> sent, pas chaque enregistrement :
-- repasser une facture deja envoyee en "envoyee" ne doit pas la renvoyer.

CREATE OR REPLACE FUNCTION public.set_invoice_status_notifying(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_status text
)
RETURNS TABLE(status text, notification_queued boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous text;
  v_invoice record;
  v_recipient text;
  v_cc text[] := ARRAY[]::text[];
  v_team text;
  v_queued boolean := false;
BEGIN
  -- invoices_monthly.status est un ENUM (invoice_status), pas du texte : la
  -- comparaison comme l'affectation doivent etre castees explicitement.
  IF p_status NOT IN ('draft', 'sent', 'paid') THEN
    RAISE EXCEPTION 'statut de facture invalide: %', p_status;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices_monthly
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'facture introuvable';
  END IF;

  v_previous := v_invoice.status::text;

  UPDATE public.invoices_monthly
  SET status = p_status::invoice_status
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id;

  -- Seule la transition compte.
  IF p_status = 'sent' AND v_previous IS DISTINCT FROM 'sent' THEN
    SELECT ts.invoice_email INTO v_recipient
    FROM public.tenant_settings ts WHERE ts.tenant_id = p_tenant_id;

    v_team := current_setting('app.notification_team_cc', true);
    IF v_team IS NOT NULL AND v_team <> '' THEN
      v_cc := ARRAY[v_team];
    END IF;

    -- Pas de destinataire configure : on ne fabrique pas d'adresse, la
    -- transition metier reste valide et rien n'est mis en file.
    IF v_recipient IS NOT NULL AND v_recipient <> '' THEN
      INSERT INTO public.notification_outbox (
        tenant_id, idempotency_key, event_type, entity_id,
        recipient, cc, subject, payload
      ) VALUES (
        p_tenant_id,
        'invoice_sent:' || p_invoice_id::text || ':' || v_recipient,
        'invoice_sent',
        p_invoice_id,
        v_recipient,
        v_cc,
        'Votre facture ' || COALESCE(v_invoice.invoice_number, v_invoice.month),
        jsonb_build_object(
          'invoice_id', p_invoice_id,
          'invoice_number', v_invoice.invoice_number,
          'month', v_invoice.month,
          'total_ht', v_invoice.subtotal_ht,
          'total_ttc', v_invoice.total_ttc
        )
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      GET DIAGNOSTICS v_queued = ROW_COUNT;
    END IF;
  END IF;

  RETURN QUERY SELECT p_status, v_queued;
END;
$$;

-- ---------------------------------------------------------------------------
-- File d'envoi : reclamation, succes, echec
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.mark_notification_sent(
  p_id uuid,
  p_worker_id text,
  p_provider text,
  p_provider_message_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.notification_outbox
  SET status = 'sent',
      sent_at = now(),
      provider = p_provider,
      provider_message_id = p_provider_message_id,
      worker_id = NULL,
      locked_until = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE id = p_id AND worker_id = p_worker_id AND status = 'sending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_notification(
  p_id uuid,
  p_worker_id text,
  p_error text,
  p_permanent boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notification_outbox;
  v_next text;
BEGIN
  SELECT * INTO v_row FROM public.notification_outbox
  WHERE id = p_id AND worker_id = p_worker_id AND status = 'sending'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Une adresse invalide ne se repare pas en reessayant.
  IF p_permanent OR v_row.attempt_count >= 5 THEN
    v_next := 'failed';
  ELSE
    v_next := 'queued';
  END IF;

  UPDATE public.notification_outbox
  SET status = v_next,
      last_error = left(COALESCE(p_error, ''), 500),
      next_attempt_at = CASE WHEN v_next = 'queued'
        THEN now() + make_interval(mins => LEAST(120, 5 * (2 ^ (v_row.attempt_count - 1)))::integer)
        ELSE next_attempt_at END,
      worker_id = NULL,
      locked_until = NULL,
      updated_at = now()
  WHERE id = p_id;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.set_invoice_status_notifying(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_notifications(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_notification_sent(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_notification(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_invoice_status_notifying(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_notifications(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_sent(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_notification(uuid, text, text, boolean) TO service_role;

COMMENT ON TABLE public.notification_outbox IS
  'File d''envoi. L''evenement est insere avec la mutation metier ; l''envoi est asynchrone et son echec n''annule rien.';
