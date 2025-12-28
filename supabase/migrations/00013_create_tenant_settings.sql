-- Migration: Create tenant_settings table
-- Description: Per-tenant settings including Sendcloud credentials

CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sendcloud_api_key TEXT, -- Encrypted or via Vault
    sendcloud_secret TEXT,  -- Encrypted or via Vault
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one settings row per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

-- Enable RLS
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view/manage tenant settings
CREATE POLICY tenant_settings_select ON tenant_settings
    FOR SELECT USING (auth.is_super_admin());

CREATE POLICY tenant_settings_insert ON tenant_settings
    FOR INSERT WITH CHECK (auth.is_super_admin());

CREATE POLICY tenant_settings_update ON tenant_settings
    FOR UPDATE USING (auth.is_super_admin());

CREATE POLICY tenant_settings_delete ON tenant_settings
    FOR DELETE USING (auth.is_super_admin());

-- Trigger to update updated_at
CREATE TRIGGER tenant_settings_updated_at
    BEFORE UPDATE ON tenant_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE tenant_settings IS 'Per-tenant configuration including API credentials';
COMMENT ON COLUMN tenant_settings.sendcloud_api_key IS 'Sendcloud API key (should be encrypted)';
COMMENT ON COLUMN tenant_settings.sendcloud_secret IS 'Sendcloud API secret (should be encrypted)';
COMMENT ON COLUMN tenant_settings.sync_enabled IS 'Whether automatic sync is enabled for this tenant';
