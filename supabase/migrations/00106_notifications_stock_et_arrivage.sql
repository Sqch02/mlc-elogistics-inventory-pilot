-- Notifications stock et arrivage.
--
-- Meme principe que la facture : l'evenement est insere dans la MEME
-- transaction que la mutation metier, l'envoi vient apres et son echec
-- n'annule rien.
--
-- POURQUOI DES DECLENCHEURS EN BASE plutot que du code applicatif. Le stock
-- bouge par plusieurs chemins -- expedition, retour, ajustement manuel,
-- reconciliation -- et l'arrivage par au moins deux. Poser la notification
-- dans chaque appelant, c'est se garantir d'en oublier un, et de ne s'en
-- apercevoir que le jour ou un client dira ne pas avoir ete prevenu.

-- ---------------------------------------------------------------------------
-- Alerte de stock : au FRANCHISSEMENT du seuil
-- ---------------------------------------------------------------------------
-- Le declencheur ne se lit pas "stock bas" mais "le stock vient de passer
-- sous le seuil". Un stock durablement bas ne doit pas produire une alerte a
-- chaque expedition : ce serait du bruit, et le bruit finit ignore.
--
-- Le rearmement est porte par la comparaison ancien/nouveau : il faut etre
-- repasse AU-DESSUS du seuil pour qu'une nouvelle descente alerte. La cle
-- d'idempotence ajoute un plafond d'une alerte par produit et par jour, au
-- cas ou le stock oscillerait autour du seuil.

CREATE OR REPLACE FUNCTION public.notify_stock_threshold()
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
  SELECT s.sku_code, s.name, s.alert_threshold, s.tenant_id
  INTO v_sku
  FROM public.skus s WHERE s.id = NEW.sku_id;

  -- Sans seuil defini, il n'y a pas de franchissement possible.
  IF v_sku.alert_threshold IS NULL OR v_sku.alert_threshold <= 0 THEN
    RETURN NEW;
  END IF;

  -- LE FRANCHISSEMENT, pas l'etat. On etait au-dessus, on passe dessous.
  IF NOT (COALESCE(OLD.qty_current, 0) > v_sku.alert_threshold
          AND NEW.qty_current <= v_sku.alert_threshold) THEN
    RETURN NEW;
  END IF;

  SELECT ts.stock_alert_email INTO v_recipient
  FROM public.tenant_settings ts WHERE ts.tenant_id = NEW.tenant_id;

  IF v_recipient IS NULL OR v_recipient = '' THEN
    RETURN NEW;
  END IF;

  v_team := current_setting('app.notification_team_cc', true);
  IF v_team IS NOT NULL AND v_team <> '' THEN
    v_cc := ARRAY[v_team];
  END IF;

  INSERT INTO public.notification_outbox (
    tenant_id, idempotency_key, event_type, entity_id,
    recipient, cc, subject, payload
  ) VALUES (
    NEW.tenant_id,
    'stock_threshold:' || NEW.sku_id::text || ':' || to_char(now(), 'YYYY-MM-DD'),
    'stock_threshold_reached',
    NEW.sku_id,
    v_recipient,
    v_cc,
    'Stock bas : ' || COALESCE(v_sku.name, v_sku.sku_code),
    jsonb_build_object(
      'sku_id', NEW.sku_id,
      'sku_code', v_sku.sku_code,
      'sku_name', v_sku.name,
      'qty_current', NEW.qty_current,
      'threshold', v_sku.alert_threshold
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_snapshots_notify_threshold ON public.stock_snapshots;
CREATE TRIGGER stock_snapshots_notify_threshold
  AFTER UPDATE OF qty_current ON public.stock_snapshots
  FOR EACH ROW
  WHEN (NEW.qty_current IS DISTINCT FROM OLD.qty_current)
  EXECUTE FUNCTION public.notify_stock_threshold();

-- ---------------------------------------------------------------------------
-- Arrivage : UN email par groupe, quand le groupe est complet
-- ---------------------------------------------------------------------------
-- Un arrivage est saisi en plusieurs lignes partageant un group_id, et
-- receptionne ligne par ligne. Notifier a chaque ligne enverrait dix emails
-- pour une seule livraison. On attend donc que la DERNIERE ligne encore en
-- attente passe en receptionnee, et on resume tout le groupe.

CREATE OR REPLACE FUNCTION public.notify_inbound_group_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restantes integer;
  v_recipient text;
  v_team text;
  v_cc text[] := ARRAY[]::text[];
  v_lignes integer;
  v_unites bigint;
BEGIN
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF;

  -- Reste-t-il des lignes en attente dans ce groupe ?
  SELECT count(*) INTO v_restantes
  FROM public.inbound_restock r
  WHERE r.group_id = NEW.group_id AND r.status = 'pending';

  IF v_restantes > 0 THEN RETURN NEW; END IF;

  SELECT count(*), COALESCE(sum(r.qty), 0) INTO v_lignes, v_unites
  FROM public.inbound_restock r
  WHERE r.group_id = NEW.group_id AND r.received = true;

  -- Un groupe entierement rejete ne merite pas un email d'arrivage.
  IF v_lignes = 0 THEN RETURN NEW; END IF;

  SELECT ts.inbound_email INTO v_recipient
  FROM public.tenant_settings ts WHERE ts.tenant_id = NEW.tenant_id;

  IF v_recipient IS NULL OR v_recipient = '' THEN RETURN NEW; END IF;

  v_team := current_setting('app.notification_team_cc', true);
  IF v_team IS NOT NULL AND v_team <> '' THEN
    v_cc := ARRAY[v_team];
  END IF;

  INSERT INTO public.notification_outbox (
    tenant_id, idempotency_key, event_type, entity_id,
    recipient, cc, subject, payload
  ) VALUES (
    NEW.tenant_id,
    -- Par GROUPE, pas par ligne : c'est ce qui garantit un seul email meme si
    -- plusieurs receptions se terminent en meme temps.
    'inbound_received:' || NEW.group_id::text,
    'inbound_received',
    NEW.group_id,
    v_recipient,
    v_cc,
    'Arrivage receptionne',
    jsonb_build_object(
      'group_id', NEW.group_id,
      'sku_count', v_lignes,
      'total_units', v_unites,
      'supplier', NEW.supplier,
      'batch_reference', NEW.batch_reference
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inbound_restock_notify_group ON public.inbound_restock;
CREATE TRIGGER inbound_restock_notify_group
  AFTER UPDATE OF status ON public.inbound_restock
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status IS DISTINCT FROM 'pending')
  EXECUTE FUNCTION public.notify_inbound_group_received();

REVOKE ALL ON FUNCTION public.notify_stock_threshold() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_inbound_group_received() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.notify_stock_threshold() IS
  'Met en file une alerte au FRANCHISSEMENT du seuil, pas sur un etat de stock bas.';
COMMENT ON FUNCTION public.notify_inbound_group_received() IS
  'Met en file UN email par group_id, quand plus aucune ligne du groupe n''est en attente.';
