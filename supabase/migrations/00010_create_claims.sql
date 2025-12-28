-- Migration: Create claims table
-- Description: Customer claims/SAV with manual indemnification

-- Claim status enum
CREATE TYPE claim_status AS ENUM ('ouverte', 'en_analyse', 'indemnisee', 'refusee', 'cloturee');

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    order_ref TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status claim_status NOT NULL DEFAULT 'ouverte',
    description TEXT,
    indemnity_eur NUMERIC(10, 2),
    decision_note TEXT,
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claims_tenant ON claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_claims_opened_at ON claims(tenant_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_claims_shipment ON claims(shipment_id);
CREATE INDEX IF NOT EXISTS idx_claims_order_ref ON claims(tenant_id, order_ref);

-- Index for monthly reporting (indemnified claims)
CREATE INDEX IF NOT EXISTS idx_claims_indemnified ON claims(tenant_id, decided_at)
    WHERE status = 'indemnisee' AND indemnity_eur IS NOT NULL;

COMMENT ON TABLE claims IS 'Customer claims/SAV tracking';
COMMENT ON COLUMN claims.status IS 'Claim status: ouverte, en_analyse, indemnisee, refusee, cloturee';
COMMENT ON COLUMN claims.indemnity_eur IS 'Manual indemnification amount in EUR';
COMMENT ON COLUMN claims.decided_by IS 'User who made the indemnification decision';
