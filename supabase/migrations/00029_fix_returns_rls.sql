-- Fix: Enable RLS on returns table (was missing)
-- SAFE: Cron and webhook use adminClient (service_role) which bypasses RLS.
-- The returns API route uses createAdminClient() for writes and manual tenant_id filtering for reads.
-- Adding RLS is defense-in-depth; it won't break existing functionality.

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own tenant's returns
CREATE POLICY "Users can view own tenant returns" ON returns
  FOR SELECT USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());

-- Allow users to update their own tenant's returns (for restock actions)
CREATE POLICY "Users can update own tenant returns" ON returns
  FOR UPDATE USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());

-- INSERT and DELETE are admin-only (via service_role from cron/webhook)
-- No user-facing INSERT/DELETE policies needed
