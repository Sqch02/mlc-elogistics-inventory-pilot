-- L'alerte de derive est un signal INTERNE.
--
-- Elle partait chez le client, avec l'equipe en copie. Or ce qu'elle dit,
-- c'est "notre comptage est faux" — pas "votre stock est bas". Le client ne
-- peut rien y faire : il ne compte pas, il ne range pas, il n'ajuste pas. Il
-- ne peut que s'inquieter et demander des explications, ce qui cree du travail
-- au lieu d'en eviter.
--
-- Le destinataire naturel est donc l'equipe qui exploite l'entrepot, seule en
-- mesure de recompter et de corriger. L'alerte de SEUIL, elle, reste bien
-- destinee au client : "votre stock est bas" appelle un reapprovisionnement,
-- et c'est sa decision.
--
-- Nuance assumee : pour un client qui range lui-meme sa marchandise, savoir
-- que le comptage derive serait utile. Mais on ne peut pas le deviner par
-- client, et se tromper dans ce sens-la coute plus cher que l'inverse.

CREATE OR REPLACE FUNCTION public.notify_stock_drift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku record;
  v_equipe text[];
  v_destinataire text;
BEGIN
  IF NOT (NEW.movement_type = 'shipment'
          AND NEW.adjustment < 0
          AND COALESCE(NEW.qty_before, 0) = 0
          AND COALESCE(NEW.qty_after, 0) = 0) THEN
    RETURN NEW;
  END IF;

  SELECT s.sku_code, s.name, s.tenant_id INTO v_sku
  FROM public.skus s WHERE s.id = NEW.sku_id;

  -- Destinataire : l'equipe, pas le client.
  v_equipe := public.notification_team_cc();
  IF array_length(v_equipe, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  v_destinataire := v_equipe[1];

  INSERT INTO public.notification_outbox (
    tenant_id, idempotency_key, event_type, entity_id,
    recipient, cc, subject, payload
  ) VALUES (
    v_sku.tenant_id,
    'stock_drift:' || NEW.sku_id::text || ':' || to_char(now(), 'YYYY-MM-DD'),
    'stock_negative_drift',
    NEW.sku_id,
    v_destinataire,
    ARRAY[]::text[],
    -- Le nom du client passe dans le sujet : l'equipe suit plusieurs comptes
    -- et doit savoir lequel regarder sans ouvrir le message.
    'Stock incoherent chez '
      || COALESCE((SELECT name FROM public.tenants WHERE id = v_sku.tenant_id), 'un client')
      || ' : ' || COALESCE(v_sku.name, v_sku.sku_code),
    jsonb_build_object(
      'sku_id', NEW.sku_id,
      'sku_code', v_sku.sku_code,
      'sku_name', v_sku.name,
      'tenant_name', (SELECT name FROM public.tenants WHERE id = v_sku.tenant_id),
      'units_missing', abs(NEW.adjustment)
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_stock_drift() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.notify_stock_drift() IS
  'Alerte INTERNE : une expedition decompte un produit deja a zero. Destinataire = equipe, pas client.';
