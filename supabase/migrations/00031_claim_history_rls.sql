-- Enable RLS on claim_history table (may have been created outside migrations)
-- This migration is safe to run regardless of whether the table exists

DO $$
BEGIN
  -- Only proceed if the table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claim_history' AND table_schema = 'public') THEN
    -- Enable RLS
    ALTER TABLE claim_history ENABLE ROW LEVEL SECURITY;

    -- Drop policies if they already exist (idempotent)
    DROP POLICY IF EXISTS "Users can view own tenant claim history" ON claim_history;
    DROP POLICY IF EXISTS "Users can insert own tenant claim history" ON claim_history;

    -- SELECT policy
    CREATE POLICY "Users can view own tenant claim history" ON claim_history
      FOR SELECT USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());

    -- INSERT policy
    CREATE POLICY "Users can insert own tenant claim history" ON claim_history
      FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id() OR public.is_super_admin());

    RAISE NOTICE 'RLS enabled on claim_history with tenant-scoped policies';
  ELSE
    RAISE NOTICE 'claim_history table does not exist, skipping RLS setup';
  END IF;
END $$;
