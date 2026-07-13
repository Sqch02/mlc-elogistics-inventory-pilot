-- P0 SECU: le `REVOKE ... FROM anon, authenticated` des migrations precedentes
-- (00060/00063/00077...) etait un NO-OP : le droit EXECUTE etait herite de PUBLIC,
-- qui n'avait jamais ete revoque. Consequence exploitable en prod : le role `anon`
-- (cle publique du bundle front) a auth.uid() = NULL, donc le garde-fou tenant
-- `IF auth.uid() IS NOT NULL AND ... THEN RAISE` etait entierement saute -> lecture
-- cross-tenant (analytics, claims, dashboard) et ecriture cross-tenant du stock
-- (apply_stock_delta) sans aucune authentification.
--
-- On revoque explicitement PUBLIC + anon, puis on GRANT precisement :
--   * RPC ecriture / admin / refresh / lock / triggers -> service_role UNIQUEMENT
--     (toutes appelees via getAdminDb() cote serveur)
--   * RPC lecture analytics / dashboard / claims         -> authenticated + service_role
--     (certaines appelees en getServerDb() = role authenticated ; le garde-fou tenant
--      protege authenticated car auth.uid() y est non-NULL)
--
-- Laisses inchanges : get_my_profile / get_tenant_id / is_super_admin (bootstrap auth
-- + RLS ; ne renvoient que les infos du appelant lui-meme, aucune fuite cross-tenant).

DO $$
DECLARE r record;
BEGIN
  -- 1) service_role uniquement
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'apply_stock_delta','remap_unmapped_items','refresh_all_analytics_views',
      'refresh_dashboard_daily','refresh_physical_items_view','refresh_shopify_anomaly_items',
      'refresh_sku_metrics','reconcile_stuck_candidates','suggest_skus_for_label',
      'detect_shopify_anomalies','try_cron_tenant_lock','release_cron_tenant_lock',
      'map_shipment_item','get_last_sync_cursor','handle_new_user','guard_invoice_immutability',
      'update_updated_at','trigger_remap_on_mapping_change','trigger_remap_on_sku_change'
    )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;

  -- 2) lecture : authenticated (garde-fou tenant) + service_role ; anon revoque
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'analytics_monthly_shipments','analytics_sku_sales','get_all_claims',
      'get_carrier_performance','get_daily_shipments_aggregated','get_dashboard_metrics',
      'get_monthly_indemnities','get_products_metrics','get_shipment_stats',
      'get_sku_consumption_metrics'
    )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;
