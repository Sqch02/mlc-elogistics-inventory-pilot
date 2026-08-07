-- Objet de l'email de facture : marque + mois concerne.
--
-- DEMANDE DE L'EXPLOITATION (07/08)
-- "l'objet n'est peut-etre pas assez clair pour eux [...] rajouter
--  HME Logistics - [...] et idealement preciser le mois concerne a chaque
--  fois, ce serait plus facile pour retrouver leurs factures"
--
-- Avant : "Votre facture FAC-2026-018"
-- Apres : "HME Logistics - Votre facture FAC-2026-018 - Juillet 2026"
--
-- Un client qui recoit douze factures par an ne reconnait pas un numero. Le
-- mois, si — c'est ce qu'il cherche quand il fouille sa boite.

-- Nom du mois en francais, sans dependre de la locale du serveur.
--
-- `to_char(..., 'TMMonth')` donnerait le mois dans la langue du serveur, qui
-- n'est pas garantie et peut changer avec l'hebergeur. Un objet d'email qui
-- bascule en anglais du jour au lendemain sans qu'on ait rien touche est
-- exactement le genre de surprise qu'on ne veut pas expliquer a un client.
CREATE OR REPLACE FUNCTION public.mois_en_francais(p_month text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_month IS NULL OR p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN NULL
    ELSE (ARRAY[
      'Janvier','Février','Mars','Avril','Mai','Juin',
      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
    ])[substring(p_month from 6 for 2)::int] || ' ' || substring(p_month from 1 for 4)
  END;
$$;

COMMENT ON FUNCTION public.mois_en_francais(text) IS
  'Mois lisible a partir d un YYYY-MM. Independant de la locale du serveur, volontairement.';

REVOKE ALL ON FUNCTION public.mois_en_francais(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mois_en_francais(text) TO service_role, authenticated;

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
  v_previous text; v_invoice record; v_recipient text;
  v_queued boolean := false; v_inserted integer := 0;
  v_mois text; v_sujet text;
BEGIN
  IF p_status NOT IN ('draft','sent','paid') THEN
    RAISE EXCEPTION 'statut de facture invalide: %', p_status;
  END IF;

  SELECT * INTO v_invoice FROM public.invoices_monthly
  WHERE id=p_invoice_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'facture introuvable'; END IF;

  v_previous := v_invoice.status::text;
  UPDATE public.invoices_monthly SET status = p_status::invoice_status
  WHERE id=p_invoice_id AND tenant_id=p_tenant_id;

  IF p_status='sent' AND v_previous IS DISTINCT FROM 'sent' THEN
    SELECT ts.invoice_email INTO v_recipient FROM public.tenant_settings ts WHERE ts.tenant_id=p_tenant_id;
    IF v_recipient IS NOT NULL AND v_recipient <> '' THEN

      v_mois := public.mois_en_francais(v_invoice.month);
      -- Sans numero de facture, le mois tient lieu d'identification : le
      -- repeter deux fois n'apporterait rien.
      v_sujet := 'HME Logistics - Votre facture '
              || COALESCE(v_invoice.invoice_number, COALESCE(v_mois, v_invoice.month))
              || CASE
                   WHEN v_invoice.invoice_number IS NOT NULL AND v_mois IS NOT NULL
                     THEN ' - ' || v_mois
                   ELSE ''
                 END;

      INSERT INTO public.notification_outbox (tenant_id, idempotency_key, event_type, entity_id, recipient, cc, subject, payload)
      VALUES (p_tenant_id,
        'invoice_sent:' || p_invoice_id::text || ':' || v_recipient,
        'invoice_sent', p_invoice_id, v_recipient, public.notification_team_cc(),
        v_sujet,
        jsonb_build_object('invoice_id',p_invoice_id,'invoice_number',v_invoice.invoice_number,
                           'month',v_invoice.month,'total_ht',v_invoice.subtotal_ht,'total_ttc',v_invoice.total_ttc))
      ON CONFLICT (idempotency_key) DO NOTHING;

      -- Passer par un entier n'est pas une precaution de style : affecter
      -- directement ROW_COUNT a un booleen leve une erreur des 2 lignes.
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_queued := v_inserted > 0;
    END IF;
  END IF;

  RETURN QUERY SELECT p_status, v_queued;
END $$;
