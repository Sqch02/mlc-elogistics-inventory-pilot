-- P3 Ops: drop duplicate and unused indexes confirmed by Supabase advisor.
-- This trims the index bloat that was carried over from earlier migrations.
-- Each dropped index has either an identical twin (kept the canonical name)
-- or zero pg_stat_user_indexes.idx_scan after months of production traffic.

DROP INDEX IF EXISTS public.idx_claim_history_claim;
DROP INDEX IF EXISTS public.idx_claim_history_tenant;
DROP INDEX IF EXISTS public.idx_claims_claim_type;
DROP INDEX IF EXISTS public.idx_returns_tenant;

DROP INDEX IF EXISTS public.idx_inbound_restock_tenant;
DROP INDEX IF EXISTS public.idx_profiles_tenant_id;
DROP INDEX IF EXISTS public.idx_invoices_monthly_tenant;
DROP INDEX IF EXISTS public.idx_returns_tracking;
DROP INDEX IF EXISTS public.idx_claim_history_changed_by;
DROP INDEX IF EXISTS public.idx_locations_active;
DROP INDEX IF EXISTS public.idx_claims_indemnified;
DROP INDEX IF EXISTS public.idx_tenants_active;
DROP INDEX IF EXISTS public.idx_skus_gtin;
DROP INDEX IF EXISTS public.idx_shipments_city;
DROP INDEX IF EXISTS public.idx_skus_sendcloud_filter;
DROP INDEX IF EXISTS public.idx_returns_announced_at;
DROP INDEX IF EXISTS public.idx_inbound_group;
DROP INDEX IF EXISTS public.idx_dismissed_anomalies_tenant;
DROP INDEX IF EXISTS public.idx_sku_mappings_tenant;
DROP INDEX IF EXISTS public.idx_shipments_tenant_tracking;
DROP INDEX IF EXISTS public.idx_profiles_id_role;
