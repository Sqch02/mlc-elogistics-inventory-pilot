-- Migration: Enrich tenants table for multi-client support
-- Description: Add business info fields to tenants table

-- Add new columns to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS siren TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS siret TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'France';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create unique index on code (allows NULL but unique when set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code) WHERE code IS NOT NULL;

-- Index for filtering by active status
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

-- Comments for documentation
COMMENT ON COLUMN tenants.code IS 'Unique short code for client (e.g., FLORNA, ACME)';
COMMENT ON COLUMN tenants.siren IS 'French SIREN number (9 digits)';
COMMENT ON COLUMN tenants.siret IS 'French SIRET number (14 digits)';
COMMENT ON COLUMN tenants.vat_number IS 'VAT identification number (e.g., FR12345678901)';
COMMENT ON COLUMN tenants.is_active IS 'Whether the tenant is active (inactive tenants cannot login)';
