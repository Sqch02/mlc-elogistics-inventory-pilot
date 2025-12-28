-- Migration: Create shipments and shipment_items tables
-- Description: Shipments from Sendcloud with pricing status

-- Pricing status enum
CREATE TYPE pricing_status AS ENUM ('ok', 'missing');

-- Shipments (from Sendcloud)
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sendcloud_id TEXT NOT NULL,
    shipped_at TIMESTAMPTZ NOT NULL,
    carrier TEXT NOT NULL,
    service TEXT,
    weight_grams INTEGER NOT NULL,
    order_ref TEXT,
    tracking TEXT,
    pricing_status pricing_status NOT NULL DEFAULT 'missing',
    computed_cost_eur NUMERIC(10, 2),
    raw_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRITICAL: Unique constraint on sendcloud_id for idempotent sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_sendcloud_id ON shipments(sendcloud_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_shipped_at ON shipments(tenant_id, shipped_at);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON shipments(tenant_id, carrier);
CREATE INDEX IF NOT EXISTS idx_shipments_pricing_status ON shipments(tenant_id, pricing_status);
CREATE INDEX IF NOT EXISTS idx_shipments_order_ref ON shipments(tenant_id, order_ref);

-- Shipment items (SKUs in a shipment)
CREATE TABLE IF NOT EXISTS shipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT qty_positive CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_tenant ON shipment_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_sku ON shipment_items(sku_id);

-- Unique constraint: one entry per shipment/sku pair (quantities are summed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_items_shipment_sku ON shipment_items(shipment_id, sku_id);

COMMENT ON TABLE shipments IS 'Shipments synced from Sendcloud';
COMMENT ON COLUMN shipments.sendcloud_id IS 'Unique Sendcloud parcel/shipment ID for idempotent sync';
COMMENT ON COLUMN shipments.weight_grams IS 'Label weight in grams (used for pricing)';
COMMENT ON COLUMN shipments.pricing_status IS 'ok if pricing matched, missing if no tariff found';
COMMENT ON COLUMN shipments.computed_cost_eur IS 'Computed shipping cost (NULL if pricing missing)';
COMMENT ON TABLE shipment_items IS 'SKUs included in a shipment';
