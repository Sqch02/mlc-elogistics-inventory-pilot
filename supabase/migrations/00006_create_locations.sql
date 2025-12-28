-- Migration: Create locations and location_assignments tables
-- Description: Warehouse locations (racks/bins) with SKU assignments

-- Locations (physical storage locations)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    label TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: location code unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_tenant_code ON locations(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(tenant_id, active) WHERE active = true;

-- Location assignments (which SKU is in which location)
-- CONSTRAINT: 1 SKU per location (unique on location_id)
CREATE TABLE IF NOT EXISTS location_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT
);

-- CRITICAL: Unique constraint on location_id ensures 1 SKU per location
CREATE UNIQUE INDEX IF NOT EXISTS idx_location_assignments_location ON location_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_location_assignments_tenant ON location_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_location_assignments_sku ON location_assignments(sku_id);

COMMENT ON TABLE locations IS 'Physical storage locations (racks, bins, shelves)';
COMMENT ON COLUMN locations.code IS 'Location code (e.g., A-01-02)';
COMMENT ON TABLE location_assignments IS 'Assignment of SKUs to locations (1 SKU per location)';
COMMENT ON CONSTRAINT idx_location_assignments_location ON location_assignments IS 'Ensures only 1 SKU per location';
