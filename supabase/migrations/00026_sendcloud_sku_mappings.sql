-- Table to map Sendcloud item descriptions to SKU/bundle codes
CREATE TABLE IF NOT EXISTS sendcloud_sku_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description_pattern TEXT NOT NULL,
  sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_mapping_tenant_desc
  ON sendcloud_sku_mappings(tenant_id, LOWER(description_pattern));

CREATE INDEX idx_mapping_tenant
  ON sendcloud_sku_mappings(tenant_id);

-- Column to store unmatched parcel items for later mapping
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS unmapped_items JSONB;

COMMENT ON TABLE sendcloud_sku_mappings IS 'Maps Sendcloud parcel_items descriptions to SKU/bundle IDs';
COMMENT ON COLUMN shipments.unmapped_items IS 'Parcel items that could not be matched to any SKU during sync';
