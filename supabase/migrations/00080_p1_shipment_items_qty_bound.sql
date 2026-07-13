-- P1 data-integrity: borne haute defensive sur shipment_items.qty. La seule
-- contrainte etait CHECK (qty > 0). Un import ANTEOS (01/03) a injecte des qty a
-- 3843 (~30k unites fantomes) qui ont gonfle analytics et stock. Borne large
-- (10000) : ne rejette aucune commande plausible, sert de tripwire contre un
-- futur bug d'accumulation/import. Le REPLACE de processShipmentItems traite deja
-- la cause principale ; ceci est une ceinture de securite.
ALTER TABLE public.shipment_items
  ADD CONSTRAINT shipment_items_qty_reasonable CHECK (qty <= 10000);
