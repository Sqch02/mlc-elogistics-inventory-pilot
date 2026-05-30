-- Move all backup_20260530_* tables from public to backup schema.
-- Reason: PostgREST exposes the public schema. Even if these tables have no
-- explicit grants, leaving them in public clutters the API surface and the
-- Supabase advisor flags them as rls_disabled_in_public x25. Moving them to
-- a dedicated 'backup' schema removes them from PostgREST entirely.
-- Rollback (if needed): ALTER TABLE backup.<x> SET SCHEMA public;

CREATE SCHEMA IF NOT EXISTS backup;

ALTER TABLE IF EXISTS public.backup_20260530_bundle_components SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_bundles SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_claim_history SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_claims SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_dismissed_anomalies SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_inbound_restock SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_invoice_lines SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_invoices_monthly SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_location_assignments SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_locations SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_pricing_rules SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_profiles SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_returns SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_sendcloud_sku_mappings SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_shipment_items SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_shipments SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_sku_mappings SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_skus SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_stock_movements SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_stock_snapshots SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_sync_runs_last30d SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_tenant_settings SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_tenants SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_unmapped_items_meta SET SCHEMA backup;
ALTER TABLE IF EXISTS public.backup_20260530_unmapped_items_sample SET SCHEMA backup;

REVOKE ALL ON SCHEMA backup FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA backup FROM anon, authenticated;
