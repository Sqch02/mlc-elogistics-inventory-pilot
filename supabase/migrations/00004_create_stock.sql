-- Migration: Create stock tables
-- Description: Stock snapshots and inbound restock tracking

-- Current stock per SKU
CREATE TABLE IF NOT EXISTS stock_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    qty_current INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one stock snapshot per SKU
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_snapshots_sku ON stock_snapshots(sku_id);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_tenant ON stock_snapshots(tenant_id);

-- Expected restocks / inbound shipments
CREATE TABLE IF NOT EXISTS inbound_restock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL,
    eta_date DATE NOT NULL,
    note TEXT,
    received BOOLEAN NOT NULL DEFAULT false,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_restock_tenant ON inbound_restock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_restock_sku ON inbound_restock(sku_id);
CREATE INDEX IF NOT EXISTS idx_inbound_restock_eta ON inbound_restock(tenant_id, eta_date);
CREATE INDEX IF NOT EXISTS idx_inbound_restock_pending ON inbound_restock(tenant_id, received) WHERE received = false;

COMMENT ON TABLE stock_snapshots IS 'Current stock levels per SKU';
COMMENT ON TABLE inbound_restock IS 'Expected incoming stock (restock/inbound shipments)';

-- Trigger to update stock_snapshots.updated_at
CREATE TRIGGER stock_snapshots_updated_at
    BEFORE UPDATE ON stock_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
