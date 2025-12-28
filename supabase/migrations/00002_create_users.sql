-- Migration: Create profiles table and user role enum
-- Description: User profiles linked to Supabase Auth with role management

-- Create user role enum
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'ops', 'sav');

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'ops',
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Unique constraint on email per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_tenant_email ON profiles(tenant_id, email);

COMMENT ON TABLE profiles IS 'User profiles with tenant association and roles';
COMMENT ON COLUMN profiles.role IS 'User role: super_admin (global), admin (tenant admin), ops (operations), sav (customer service)';

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Note: tenant_id must be set manually after signup or via invite flow
    -- This trigger just ensures a profile row exists
    INSERT INTO profiles (id, tenant_id, email, role)
    VALUES (
        NEW.id,
        COALESCE(
            (NEW.raw_user_meta_data->>'tenant_id')::UUID,
            (SELECT id FROM tenants LIMIT 1)  -- Fallback to first tenant for pilot
        ),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'ops')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
