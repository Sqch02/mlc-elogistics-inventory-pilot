-- Migration: Create bundles and bundle_components tables
-- Description: BOM (Bill of Materials) for product bundles

-- Bundles (parent SKU that is composed of other SKUs)
CREATE TABLE IF NOT EXISTS bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bundle_sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one bundle per SKU
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundles_sku ON bundles(bundle_sku_id);
CREATE INDEX IF NOT EXISTS idx_bundles_tenant ON bundles(tenant_id);

-- Bundle components (the SKUs that make up a bundle)
CREATE TABLE IF NOT EXISTS bundle_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    component_sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    qty_component INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT qty_component_positive CHECK (qty_component > 0)
);

-- Unique constraint: one component entry per bundle/component pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_components_unique ON bundle_components(bundle_id, component_sku_id);
CREATE INDEX IF NOT EXISTS idx_bundle_components_tenant ON bundle_components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bundle_components_bundle ON bundle_components(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_components_component ON bundle_components(component_sku_id);

COMMENT ON TABLE bundles IS 'Product bundles (kits) definition';
COMMENT ON TABLE bundle_components IS 'Components that make up a bundle with quantities';
COMMENT ON COLUMN bundle_components.qty_component IS 'Quantity of this component in the bundle';
