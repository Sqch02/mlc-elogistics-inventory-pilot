-- P1 stock/integrity: la contrainte d'unicite d'unmapped_items etait
-- UNIQUE(shipment_id, raw_sku, raw_description, raw_variant_id) en NULLS DISTINCT
-- (defaut). Pour les lignes Shopify description-seule ces colonnes sont NULL, donc
-- aucune ligne ne rentrait jamais en conflit -> l'upsert re-inserait une nouvelle
-- ligne a CHAQUE evenement webhook -> ~1,9M doublons + risque de sur-decrement
-- N-fold au remap.
--
-- Prerequis (fait hors migration) : dedup des ~1,9M lignes dupliquees + fix app
-- processShipmentItems en REPLACE par expedition (delete-then-insert).
--
-- On remplace la contrainte par une version NULLS NOT DISTINCT : deux lignes avec
-- les memes valeurs (NULL compris) entrent desormais en conflit -> plus de
-- duplication possible.
ALTER TABLE public.unmapped_items
  DROP CONSTRAINT IF EXISTS unmapped_items_shipment_id_raw_sku_raw_description_raw_vari_key;

ALTER TABLE public.unmapped_items
  ADD CONSTRAINT unmapped_items_dedup_nnd
  UNIQUE NULLS NOT DISTINCT (shipment_id, raw_sku, raw_description, raw_variant_id);
