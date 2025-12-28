-- Migration: Add super_admin role
-- Phase 13: Multi-tenant admin support

-- Add super_admin to the user_role enum
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in PostgreSQL
-- This migration should be run separately

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin';

-- Update RLS policies to allow super_admin full access

-- Tenants: super_admin can manage all tenants
DROP POLICY IF EXISTS "Super admin can manage tenants" ON tenants;
CREATE POLICY "Super admin can manage tenants" ON tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Profiles: super_admin can view all profiles
DROP POLICY IF EXISTS "Super admin can view all profiles" ON profiles;
CREATE POLICY "Super admin can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
    )
    OR id = auth.uid()
    OR tenant_id = auth.tenant_id()
  );

-- Tenant settings: super_admin can manage all settings
DROP POLICY IF EXISTS "Super admin can manage tenant settings" ON tenant_settings;
CREATE POLICY "Super admin can manage tenant settings" ON tenant_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Comment
COMMENT ON TYPE user_role IS 'User roles: super_admin (system-wide), admin (tenant), ops (operations), sav (customer service)';
