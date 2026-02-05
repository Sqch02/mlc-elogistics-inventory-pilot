-- Migration: Add client role and create Florna tenant
-- Description: Add 'client' role for brand users and create Florna tenant for demo

-- Add 'client' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';

-- Create Florna tenant
INSERT INTO tenants (id, name, code, is_active)
VALUES (
    'f1073a00-0000-4000-a000-000000000001',
    'Florna',
    'FLORNA',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Create tenant_settings for Florna
INSERT INTO tenant_settings (tenant_id)
VALUES ('f1073a00-0000-4000-a000-000000000001')
ON CONFLICT (tenant_id) DO NOTHING;

COMMENT ON TYPE user_role IS 'User roles: super_admin (global), admin (tenant admin), ops (operations), sav (customer service), client (brand user with limited view)';
