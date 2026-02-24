-- Ajouter group_id pour grouper les lignes d'un meme arrivage
ALTER TABLE inbound_restock ADD COLUMN IF NOT EXISTS group_id UUID DEFAULT gen_random_uuid();

-- Nombre de palettes (au niveau du groupe, meme valeur pour toutes les lignes du groupe)
ALTER TABLE inbound_restock ADD COLUMN IF NOT EXISTS nb_palettes INTEGER;

-- Numero de lot par produit (individuel par ligne)
ALTER TABLE inbound_restock ADD COLUMN IF NOT EXISTS lot_number TEXT;

-- Index pour grouper rapidement
CREATE INDEX IF NOT EXISTS idx_inbound_group ON inbound_restock(tenant_id, group_id);
