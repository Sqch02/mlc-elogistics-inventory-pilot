-- Alerte de derive de stock.
--
-- LE SIGNAL, ET POURQUOI IL MANQUAIT. L'alerte de seuil dit "votre stock est
-- bas" et ne se declenche qu'au franchissement. Une fois le stock a zero, elle
-- se tait definitivement — alors que c'est precisement la que le probleme
-- commence : chaque expedition suivante decompte un produit que l'application
-- croit absent, et le plancher a zero absorbe l'ecart en silence.
--
-- Mesure sur 30 jours, 3 clients : 384 decomptes a vide, dont 333 pour un seul
-- client sur 4 produits. Autant de preuves que le stock enregistre est faux,
-- et pas une seule alerte. Un produit totalise 226 unites sorties sans jamais
-- avoir ete decomptees.
--
-- La cause de fond n'est pas technique : les entrees de marchandise ne sont pas
-- declarees dans l'application, qui ne sait donc que decompter. Tant que la
-- saisie des arrivages n'est pas adoptee, cette alerte est le seul moyen de
-- savoir qu'un stock a decroche AVANT que le client ne s'en plaigne.

ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_event_type_check;
ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_event_type_check CHECK (event_type IN (
    'invoice_sent', 'stock_threshold_reached', 'inbound_received', 'stock_negative_drift'
  ));

CREATE OR REPLACE FUNCTION public.notify_stock_drift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku record;
  v_recipient text;
  v_team text;
  v_cc text[] := ARRAY[]::text[];
BEGIN
  -- Le fait qui compte : on a voulu decompter, et il n'y avait rien a
  -- decompter. `qty_before = qty_after = 0` avec un ajustement negatif est la
  -- signature exacte du plancher a zero.
  IF NOT (NEW.movement_type = 'shipment'
          AND NEW.adjustment < 0
          AND COALESCE(NEW.qty_before, 0) = 0
          AND COALESCE(NEW.qty_after, 0) = 0) THEN
    RETURN NEW;
  END IF;

  SELECT s.sku_code, s.name, s.tenant_id INTO v_sku
  FROM public.skus s WHERE s.id = NEW.sku_id;

  SELECT ts.stock_alert_email INTO v_recipient
  FROM public.tenant_settings ts WHERE ts.tenant_id = v_sku.tenant_id;

  IF v_recipient IS NULL OR v_recipient = '' THEN RETURN NEW; END IF;

  v_team := current_setting('app.notification_team_cc', true);
  IF v_team IS NOT NULL AND v_team <> '' THEN
    v_cc := ARRAY[v_team];
  END IF;

  INSERT INTO public.notification_outbox (
    tenant_id, idempotency_key, event_type, entity_id,
    recipient, cc, subject, payload
  ) VALUES (
    v_sku.tenant_id,
    -- Une alerte par produit et par jour : sur le client le plus touche cela
    -- plafonne a quatre, la ou l'evenement brut se produit onze fois par jour.
    -- Une alerte quotidienne se lit ; onze se filtrent.
    'stock_drift:' || NEW.sku_id::text || ':' || to_char(now(), 'YYYY-MM-DD'),
    'stock_negative_drift',
    NEW.sku_id,
    v_recipient,
    v_cc,
    'Stock incoherent : ' || COALESCE(v_sku.name, v_sku.sku_code),
    jsonb_build_object(
      'sku_id', NEW.sku_id,
      'sku_code', v_sku.sku_code,
      'sku_name', v_sku.name,
      'units_missing', abs(NEW.adjustment)
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_notify_drift ON public.stock_movements;
CREATE TRIGGER stock_movements_notify_drift
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  WHEN (NEW.movement_type = 'shipment' AND NEW.adjustment < 0)
  EXECUTE FUNCTION public.notify_stock_drift();

REVOKE ALL ON FUNCTION public.notify_stock_drift() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.notify_stock_drift() IS
  'Alerte quand une expedition decompte un produit deja a zero : preuve que le stock enregistre est faux.';

-- Vue de suivi : permet de constater la derive sans attendre un email.
CREATE OR REPLACE VIEW public.v_stock_drift_recent AS
SELECT
  s.tenant_id,
  s.sku_code,
  s.name AS sku_name,
  count(*)                     AS decomptes_a_vide,
  sum(abs(sm.adjustment))      AS unites_non_decomptees,
  min(sm.created_at)           AS premier,
  max(sm.created_at)           AS dernier
FROM public.stock_movements sm
JOIN public.skus s ON s.id = sm.sku_id
WHERE sm.movement_type = 'shipment'
  AND sm.adjustment < 0
  AND COALESCE(sm.qty_before, 0) = 0
  AND COALESCE(sm.qty_after, 0) = 0
  AND sm.created_at > now() - interval '30 days'
GROUP BY s.tenant_id, s.sku_code, s.name;

REVOKE ALL ON public.v_stock_drift_recent FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_stock_drift_recent TO service_role;
