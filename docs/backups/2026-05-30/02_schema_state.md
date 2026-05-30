# Schema State Snapshot — 2026-05-30 pre-audit-fixes

Source de verite prod au moment du backup. Pour rollback ou comprehension.

## RLS policies (80+)

- **Toutes les tables tenant-scoped** ont policies SELECT/INSERT/UPDATE/DELETE filtrant via `(tenant_id = get_tenant_id()) OR is_super_admin()`
- La plupart utilisent le form optimise `(SELECT get_tenant_id() AS get_tenant_id)` (00033 RLS optimization)
- `dismissed_anomalies` utilise la forme non-optimisee (audit signale ca P1)
- `tenant_settings` : seules les policies super_admin (pas de RW pour tenant_id meme owner) — credentials proteges
- `tenant_billing_config` : SEULEMENT policy SELECT (pas INSERT/UPDATE/DELETE) — gap audit
- `tenants` : SELECT par owner OU super_admin ; CRUD super_admin uniquement
- `profiles_select_optimized` : SELECT par self OR same tenant OR super_admin

## Materialized views (4 exposees via API)

- `v_physical_shipment_items` : 40 MB — decomposition bundles via UNION ALL + GROUP BY shipment_id/sku_id
- `mv_dashboard_daily` : 152 kB — daily aggregation shipments par tenant
- `mv_sku_metrics` : 104 kB — stock + consumption 30d/90d + days_remaining + is_bundle
- `mv_shopify_anomaly_items` : 568 kB — detection 4 types anomalies (order_ref_as_description, empty_sku, sku_with_spaces, sku_with_accents)

**Toutes GRANT SELECT TO anon, authenticated** → fuite cross-tenant lisible (Supabase advisor confirme: `materialized_view_in_api` x4).

## Triggers (7)

- `remap_on_mapping_insert` ON sku_mappings (INSERT, UPDATE) → `trigger_remap_on_mapping_change()` → `remap_unmapped_items(NEW.tenant_id)` **SANS LIMIT** (timeout risque Florna 670k unmapped)
- `remap_on_sku_insert` ON skus (INSERT, UPDATE) → `trigger_remap_on_sku_change()` → `remap_unmapped_items(NEW.tenant_id, 2000)` OK avec limit
- `skus_updated_at`, `stock_snapshots_updated_at`, `tenant_settings_updated_at` BEFORE UPDATE → update_updated_at()

## RPCs (28)

Voir `01_rpcs_pre_fixes.md`. Resume:
- Toutes GRANT EXECUTE TO anon, authenticated (anti-pattern selon Supabase advisor : 56 findings WARN)
- 3 sans `SET search_path` : `get_monthly_indemnities`, `get_shipping_price` (SECURITY INVOKER), `get_all_claims`
- `handle_new_user` : assigne au 1er tenant (pas a raw_user_meta_data — l'audit etait imprecis)
- `remap_unmapped_items` v2 sans LIMIT : INSERT qty_current=-v_item.qty (negatif), pas de stock_movements, pas de bundle decomposition

## Supabase advisor officiel (security)

0 ERROR, 64 WARN, 0 INFO. Liste complete:
- `function_search_path_mutable` x3 : get_monthly_indemnities, get_shipping_price, get_all_claims
- `materialized_view_in_api` x4 : les 4 mat views ci-dessus
- `anon_security_definer_function_executable` x28 + `authenticated_security_definer_function_executable` x28 : les 28 RPCs
- `auth_leaked_password_protection` x1 : HaveIBeenPwned check desactive

## Tables backup snapshots

22 tables snapshotees vers `backup_20260530_*`. Verification counts: 100% OK (drift +2 sur shipment_items / stock_movements = activite live legitime).

Rollback pattern:
```sql
BEGIN;
TRUNCATE public.<table> CASCADE;
INSERT INTO public.<table> SELECT * FROM backup_20260530_<table>;
COMMIT;
```

## Backups git

- branch: `backup/pre-audit-fixes-2026-05-30`
- tag: `pre-audit-fixes-2026-05-30`
