-- Robust SKU mapping system
-- Prevents data loss when Shopify SKUs don't match app SKUs

-- 1. Add shopify_variant_id for reliable matching
ALTER TABLE skus ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_skus_shopify_variant_id ON skus(tenant_id, shopify_variant_id) WHERE shopify_variant_id IS NOT NULL;

-- 2. Unmapped items table (stores items that couldn't be mapped)
CREATE TABLE IF NOT EXISTS unmapped_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  raw_sku TEXT,
  raw_description TEXT,
  raw_variant_id TEXT,
  raw_product_id TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_sku_id UUID REFERENCES skus(id) ON DELETE SET NULL,
  UNIQUE(shipment_id, raw_sku, raw_description, raw_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_unmapped_items_tenant ON unmapped_items(tenant_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unmapped_items_shipment ON unmapped_items(shipment_id);

ALTER TABLE unmapped_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY unmapped_items_select ON unmapped_items FOR SELECT USING (tenant_id = (select get_tenant_id()) OR (select is_super_admin()));
CREATE POLICY unmapped_items_insert ON unmapped_items FOR INSERT WITH CHECK (tenant_id = (select get_tenant_id()) OR (select is_super_admin()));
CREATE POLICY unmapped_items_update ON unmapped_items FOR UPDATE USING (tenant_id = (select get_tenant_id()) OR (select is_super_admin()));
CREATE POLICY unmapped_items_delete ON unmapped_items FOR DELETE USING (tenant_id = (select get_tenant_id()) OR (select is_super_admin()));

-- 3. SKU mappings table (custom mapping rules)
CREATE TABLE IF NOT EXISTS sku_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('description', 'variant_id', 'product_id', 'sku_alias')),
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'ilike', 'contains')) DEFAULT 'ilike',
  target_sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, source, pattern)
);

CREATE INDEX IF NOT EXISTS idx_sku_mappings_tenant ON sku_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sku_mappings_lookup ON sku_mappings(tenant_id, source, pattern);

ALTER TABLE sku_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sku_mappings_select ON sku_mappings FOR SELECT USING (tenant_id = (select get_tenant_id()) OR (select is_super_admin()));
CREATE POLICY sku_mappings_insert ON sku_mappings FOR INSERT WITH CHECK (tenant_id = (select get_tenant_id()) OR (select is_super_admin()));
CREATE POLICY sku_mappings_update ON sku_mappings FOR UPDATE USING (tenant_id = (select get_tenant_id()) OR (select is_super_admin()));
CREATE POLICY sku_mappings_delete ON sku_mappings FOR DELETE USING (tenant_id = (select get_tenant_id()) OR (select is_super_admin()));

-- 4. Multi-level matching function
CREATE OR REPLACE FUNCTION map_shipment_item(
  p_tenant_id UUID,
  p_raw_sku TEXT,
  p_raw_description TEXT,
  p_raw_variant_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku_id UUID;
BEGIN
  IF p_raw_sku IS NOT NULL AND p_raw_sku != '' THEN
    SELECT id INTO v_sku_id FROM skus WHERE tenant_id = p_tenant_id AND sku_code = p_raw_sku LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
    SELECT id INTO v_sku_id FROM skus WHERE tenant_id = p_tenant_id AND LOWER(TRIM(sku_code)) = LOWER(TRIM(p_raw_sku)) LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;
  IF p_raw_variant_id IS NOT NULL AND p_raw_variant_id != '' THEN
    SELECT id INTO v_sku_id FROM skus WHERE tenant_id = p_tenant_id AND shopify_variant_id = p_raw_variant_id LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings WHERE tenant_id = p_tenant_id AND source = 'variant_id' AND pattern = p_raw_variant_id LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;
  IF p_raw_sku IS NOT NULL AND p_raw_sku != '' THEN
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings
    WHERE tenant_id = p_tenant_id AND source = 'sku_alias'
    AND ((match_type = 'exact' AND pattern = p_raw_sku) OR (match_type = 'ilike' AND LOWER(pattern) = LOWER(p_raw_sku)))
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;
  IF p_raw_description IS NOT NULL AND p_raw_description != '' THEN
    SELECT target_sku_id INTO v_sku_id FROM sku_mappings
    WHERE tenant_id = p_tenant_id AND source = 'description'
    AND ((match_type = 'exact' AND pattern = p_raw_description) OR (match_type = 'ilike' AND LOWER(p_raw_description) LIKE LOWER(pattern)) OR (match_type = 'contains' AND LOWER(p_raw_description) LIKE '%' || LOWER(pattern) || '%'))
    LIMIT 1;
    IF v_sku_id IS NOT NULL THEN RETURN v_sku_id; END IF;
  END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION map_shipment_item TO service_role, authenticated;

-- 5. Retroactive remapping function
CREATE OR REPLACE FUNCTION remap_unmapped_items(p_tenant_id UUID)
RETURNS TABLE(resolved INTEGER, still_unmapped INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved INTEGER := 0;
  v_item RECORD;
  v_sku_id UUID;
BEGIN
  FOR v_item IN SELECT * FROM unmapped_items WHERE tenant_id = p_tenant_id AND resolved_at IS NULL LOOP
    v_sku_id := map_shipment_item(p_tenant_id, v_item.raw_sku, v_item.raw_description, v_item.raw_variant_id);
    IF v_sku_id IS NOT NULL THEN
      INSERT INTO shipment_items (tenant_id, shipment_id, sku_id, qty)
      VALUES (v_item.tenant_id, v_item.shipment_id, v_sku_id, v_item.qty)
      ON CONFLICT (shipment_id, sku_id) DO UPDATE SET qty = shipment_items.qty + EXCLUDED.qty;
      UPDATE unmapped_items SET resolved_at = now(), resolved_sku_id = v_sku_id WHERE id = v_item.id;
      v_resolved := v_resolved + 1;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_resolved, (SELECT COUNT(*)::INTEGER FROM unmapped_items WHERE tenant_id = p_tenant_id AND resolved_at IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION remap_unmapped_items TO service_role, authenticated;

-- 6. Auto-remap triggers
CREATE OR REPLACE FUNCTION trigger_remap_on_sku_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM remap_unmapped_items(NEW.tenant_id); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS remap_on_sku_insert ON skus;
CREATE TRIGGER remap_on_sku_insert
AFTER INSERT OR UPDATE OF sku_code, shopify_variant_id ON skus
FOR EACH ROW EXECUTE FUNCTION trigger_remap_on_sku_change();

CREATE OR REPLACE FUNCTION trigger_remap_on_mapping_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM remap_unmapped_items(NEW.tenant_id); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS remap_on_mapping_insert ON sku_mappings;
CREATE TRIGGER remap_on_mapping_insert
AFTER INSERT OR UPDATE ON sku_mappings
FOR EACH ROW EXECUTE FUNCTION trigger_remap_on_mapping_change();
