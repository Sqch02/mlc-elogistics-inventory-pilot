-- Ajoute les colonnes arrivage_* au tenant_billing_config pour brancher
-- l'auto-facturation reception arrivage dans /api/invoices/generate.
-- Mode :
--   'palette' = nb_palettes du group_id (distinct) x palette_price
--   'colis'   = nb_colis (a definir) x box_price
--   'vrac'    = somme accepted_qty x unit_price
--   NULL      = pas de ligne arrivage auto

ALTER TABLE public.tenant_billing_config
  ADD COLUMN IF NOT EXISTS arrivage_billing_mode text CHECK (arrivage_billing_mode IN ('palette','colis','vrac')),
  ADD COLUMN IF NOT EXISTS arrivage_palette_price_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS arrivage_box_price_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS arrivage_unit_price_eur numeric(10,4);

INSERT INTO public.tenant_billing_config (tenant_id, arrivage_billing_mode, arrivage_palette_price_eur)
VALUES ('f1073a00-0000-4000-a000-000000000001', 'palette', 4.50)
ON CONFLICT (tenant_id) DO UPDATE SET
  arrivage_billing_mode = EXCLUDED.arrivage_billing_mode,
  arrivage_palette_price_eur = EXCLUDED.arrivage_palette_price_eur;
