-- Migration: Create tenants table
-- Description: Base tenant table for multi-tenant support

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);

COMMENT ON TABLE tenants IS 'Client tenants for multi-tenant support';
