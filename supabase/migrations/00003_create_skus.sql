-- Migration: Create SKUs table
-- Description: Product/SKU catalog with tenant isolation

CREATE TABLE IF NOT EXISTS skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL,
    name TEXT NOT NULL,
    weight_grams INTEGER,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: sku_code unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_skus_tenant_sku_code ON skus(tenant_id, sku_code);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_skus_tenant_id ON skus(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skus_active ON skus(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_skus_name ON skus(tenant_id, name);

COMMENT ON TABLE skus IS 'Product/SKU catalog';
COMMENT ON COLUMN skus.sku_code IS 'Unique SKU identifier per tenant';
COMMENT ON COLUMN skus.weight_grams IS 'Optional product weight in grams';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER skus_updated_at
    BEFORE UPDATE ON skus
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
