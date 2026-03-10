-- =====================================================================
-- ROLLBACK for migration 00033_optimize_rls_performance.sql
-- Restores ALL RLS policies to their exact state as of 2026-03-10
-- Run this ONLY if the optimization migration causes issues
-- =====================================================================

BEGIN;

-- ============================================
-- SKUS (restore original non-optimized + undo test)
-- ============================================
DROP POLICY IF EXISTS skus_select ON skus;
DROP POLICY IF EXISTS skus_insert ON skus;
DROP POLICY IF EXISTS skus_update ON skus;
DROP POLICY IF EXISTS skus_delete ON skus;

CREATE POLICY skus_select ON skus FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY skus_insert ON skus FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY skus_update ON skus FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY skus_delete ON skus FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- STOCK_SNAPSHOTS
-- ============================================
DROP POLICY IF EXISTS stock_snapshots_select ON stock_snapshots;
DROP POLICY IF EXISTS stock_snapshots_insert ON stock_snapshots;
DROP POLICY IF EXISTS stock_snapshots_update ON stock_snapshots;
DROP POLICY IF EXISTS stock_snapshots_delete ON stock_snapshots;

CREATE POLICY stock_snapshots_select ON stock_snapshots FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY stock_snapshots_insert ON stock_snapshots FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY stock_snapshots_update ON stock_snapshots FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY stock_snapshots_delete ON stock_snapshots FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- INBOUND_RESTOCK
-- ============================================
DROP POLICY IF EXISTS inbound_restock_select ON inbound_restock;
DROP POLICY IF EXISTS inbound_restock_insert ON inbound_restock;
DROP POLICY IF EXISTS inbound_restock_update ON inbound_restock;
DROP POLICY IF EXISTS inbound_restock_delete ON inbound_restock;

CREATE POLICY inbound_restock_select ON inbound_restock FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY inbound_restock_insert ON inbound_restock FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY inbound_restock_update ON inbound_restock FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY inbound_restock_delete ON inbound_restock FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- BUNDLES
-- ============================================
DROP POLICY IF EXISTS bundles_select ON bundles;
DROP POLICY IF EXISTS bundles_insert ON bundles;
DROP POLICY IF EXISTS bundles_update ON bundles;
DROP POLICY IF EXISTS bundles_delete ON bundles;

CREATE POLICY bundles_select ON bundles FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY bundles_insert ON bundles FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY bundles_update ON bundles FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY bundles_delete ON bundles FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- BUNDLE_COMPONENTS
-- ============================================
DROP POLICY IF EXISTS bundle_components_select ON bundle_components;
DROP POLICY IF EXISTS bundle_components_insert ON bundle_components;
DROP POLICY IF EXISTS bundle_components_update ON bundle_components;
DROP POLICY IF EXISTS bundle_components_delete ON bundle_components;

CREATE POLICY bundle_components_select ON bundle_components FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY bundle_components_insert ON bundle_components FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY bundle_components_update ON bundle_components FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY bundle_components_delete ON bundle_components FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- LOCATIONS
-- ============================================
DROP POLICY IF EXISTS locations_select ON locations;
DROP POLICY IF EXISTS locations_insert ON locations;
DROP POLICY IF EXISTS locations_update ON locations;
DROP POLICY IF EXISTS locations_delete ON locations;

CREATE POLICY locations_select ON locations FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY locations_insert ON locations FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY locations_update ON locations FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY locations_delete ON locations FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- LOCATION_ASSIGNMENTS
-- ============================================
DROP POLICY IF EXISTS location_assignments_select ON location_assignments;
DROP POLICY IF EXISTS location_assignments_insert ON location_assignments;
DROP POLICY IF EXISTS location_assignments_update ON location_assignments;
DROP POLICY IF EXISTS location_assignments_delete ON location_assignments;

CREATE POLICY location_assignments_select ON location_assignments FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY location_assignments_insert ON location_assignments FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY location_assignments_update ON location_assignments FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY location_assignments_delete ON location_assignments FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- SHIPMENTS
-- ============================================
DROP POLICY IF EXISTS shipments_select ON shipments;
DROP POLICY IF EXISTS shipments_insert ON shipments;
DROP POLICY IF EXISTS shipments_update ON shipments;
DROP POLICY IF EXISTS shipments_delete ON shipments;

CREATE POLICY shipments_select ON shipments FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY shipments_insert ON shipments FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY shipments_update ON shipments FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY shipments_delete ON shipments FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- SHIPMENT_ITEMS
-- ============================================
DROP POLICY IF EXISTS shipment_items_select ON shipment_items;
DROP POLICY IF EXISTS shipment_items_insert ON shipment_items;
DROP POLICY IF EXISTS shipment_items_update ON shipment_items;
DROP POLICY IF EXISTS shipment_items_delete ON shipment_items;

CREATE POLICY shipment_items_select ON shipment_items FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY shipment_items_insert ON shipment_items FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY shipment_items_update ON shipment_items FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY shipment_items_delete ON shipment_items FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- PRICING_RULES
-- ============================================
DROP POLICY IF EXISTS pricing_rules_select ON pricing_rules;
DROP POLICY IF EXISTS pricing_rules_insert ON pricing_rules;
DROP POLICY IF EXISTS pricing_rules_update ON pricing_rules;
DROP POLICY IF EXISTS pricing_rules_delete ON pricing_rules;

CREATE POLICY pricing_rules_select ON pricing_rules FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY pricing_rules_insert ON pricing_rules FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY pricing_rules_update ON pricing_rules FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY pricing_rules_delete ON pricing_rules FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- INVOICES_MONTHLY
-- ============================================
DROP POLICY IF EXISTS invoices_monthly_select ON invoices_monthly;
DROP POLICY IF EXISTS invoices_monthly_insert ON invoices_monthly;
DROP POLICY IF EXISTS invoices_monthly_update ON invoices_monthly;
DROP POLICY IF EXISTS invoices_monthly_delete ON invoices_monthly;

CREATE POLICY invoices_monthly_select ON invoices_monthly FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY invoices_monthly_insert ON invoices_monthly FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY invoices_monthly_update ON invoices_monthly FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY invoices_monthly_delete ON invoices_monthly FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- INVOICE_LINES
-- ============================================
DROP POLICY IF EXISTS invoice_lines_select ON invoice_lines;
DROP POLICY IF EXISTS invoice_lines_insert ON invoice_lines;
DROP POLICY IF EXISTS invoice_lines_update ON invoice_lines;
DROP POLICY IF EXISTS invoice_lines_delete ON invoice_lines;

CREATE POLICY invoice_lines_select ON invoice_lines FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY invoice_lines_insert ON invoice_lines FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY invoice_lines_update ON invoice_lines FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY invoice_lines_delete ON invoice_lines FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- CLAIMS
-- ============================================
DROP POLICY IF EXISTS claims_select ON claims;
DROP POLICY IF EXISTS claims_insert ON claims;
DROP POLICY IF EXISTS claims_update ON claims;
DROP POLICY IF EXISTS claims_delete ON claims;

CREATE POLICY claims_select ON claims FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY claims_insert ON claims FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY claims_update ON claims FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY claims_delete ON claims FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- SYNC_RUNS
-- ============================================
DROP POLICY IF EXISTS sync_runs_select ON sync_runs;
DROP POLICY IF EXISTS sync_runs_insert ON sync_runs;
DROP POLICY IF EXISTS sync_runs_update ON sync_runs;
DROP POLICY IF EXISTS sync_runs_delete ON sync_runs;

CREATE POLICY sync_runs_select ON sync_runs FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY sync_runs_insert ON sync_runs FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY sync_runs_update ON sync_runs FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY sync_runs_delete ON sync_runs FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- TENANTS (restore original)
-- ============================================
DROP POLICY IF EXISTS tenants_select ON tenants;
DROP POLICY IF EXISTS tenants_insert ON tenants;
DROP POLICY IF EXISTS tenants_update ON tenants;
DROP POLICY IF EXISTS tenants_delete ON tenants;

CREATE POLICY tenants_select ON tenants FOR SELECT
  USING (is_super_admin() OR (id = get_tenant_id()));
CREATE POLICY tenants_insert ON tenants FOR INSERT
  WITH CHECK (is_super_admin());
CREATE POLICY tenants_update ON tenants FOR UPDATE
  USING (is_super_admin());
CREATE POLICY tenants_delete ON tenants FOR DELETE
  USING (is_super_admin());

-- ============================================
-- TENANT_SETTINGS (restore original)
-- ============================================
DROP POLICY IF EXISTS tenant_settings_select ON tenant_settings;
DROP POLICY IF EXISTS tenant_settings_insert ON tenant_settings;
DROP POLICY IF EXISTS tenant_settings_update ON tenant_settings;
DROP POLICY IF EXISTS tenant_settings_delete ON tenant_settings;

CREATE POLICY tenant_settings_select ON tenant_settings FOR SELECT
  USING (is_super_admin());
CREATE POLICY tenant_settings_insert ON tenant_settings FOR INSERT
  WITH CHECK (is_super_admin());
CREATE POLICY tenant_settings_update ON tenant_settings FOR UPDATE
  USING (is_super_admin());
CREATE POLICY tenant_settings_delete ON tenant_settings FOR DELETE
  USING (is_super_admin());

-- ============================================
-- PROFILES (restore original insert)
-- ============================================
DROP POLICY IF EXISTS profiles_insert ON profiles;

CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (is_super_admin() OR (tenant_id = get_tenant_id()));

-- ============================================
-- RETURNS (restore ALL original policies including duplicates)
-- ============================================
DROP POLICY IF EXISTS returns_select ON returns;
DROP POLICY IF EXISTS returns_insert ON returns;
DROP POLICY IF EXISTS returns_update ON returns;
DROP POLICY IF EXISTS returns_delete ON returns;

CREATE POLICY "Users can view own tenant returns" ON returns FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY "Users can update own tenant returns" ON returns FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY returns_delete ON returns FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY returns_insert ON returns FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY returns_select ON returns FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY returns_tenant_isolation ON returns FOR ALL
  USING (tenant_id = get_tenant_id());
CREATE POLICY returns_update ON returns FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- CLAIM_HISTORY (restore ALL original policies including duplicates)
-- ============================================
DROP POLICY IF EXISTS claim_history_select ON claim_history;
DROP POLICY IF EXISTS claim_history_insert ON claim_history;

CREATE POLICY "Users can view own tenant claim history" ON claim_history FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY "Users can insert own tenant claim history" ON claim_history FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY claim_history_tenant_isolation ON claim_history FOR ALL
  USING (tenant_id = get_tenant_id());
CREATE POLICY tenant_isolation_claim_history ON claim_history FOR ALL
  USING (tenant_id = get_tenant_id());

-- ============================================
-- STOCK_MOVEMENTS (restore ALL original policies including duplicates)
-- ============================================
DROP POLICY IF EXISTS stock_movements_select ON stock_movements;
DROP POLICY IF EXISTS stock_movements_insert ON stock_movements;

CREATE POLICY stock_movements_tenant_policy ON stock_movements FOR ALL
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY tenant_isolation_stock_movements ON stock_movements FOR ALL
  USING (tenant_id = get_tenant_id());

-- ============================================
-- SENDCLOUD_SKU_MAPPINGS (restore original names)
-- ============================================
DROP POLICY IF EXISTS sendcloud_sku_mappings_select ON sendcloud_sku_mappings;
DROP POLICY IF EXISTS sendcloud_sku_mappings_insert ON sendcloud_sku_mappings;
DROP POLICY IF EXISTS sendcloud_sku_mappings_update ON sendcloud_sku_mappings;
DROP POLICY IF EXISTS sendcloud_sku_mappings_delete ON sendcloud_sku_mappings;

CREATE POLICY "Users can view own tenant mappings" ON sendcloud_sku_mappings FOR SELECT
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY "Users can insert own tenant mappings" ON sendcloud_sku_mappings FOR INSERT
  WITH CHECK ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY "Users can update own tenant mappings" ON sendcloud_sku_mappings FOR UPDATE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());
CREATE POLICY "Users can delete own tenant mappings" ON sendcloud_sku_mappings FOR DELETE
  USING ((tenant_id = get_tenant_id()) OR is_super_admin());

-- ============================================
-- TENANT_BILLING_CONFIG (restore original)
-- ============================================
DROP POLICY IF EXISTS tenant_billing_config_select ON tenant_billing_config;

CREATE POLICY tenant_billing_config_tenant_isolation ON tenant_billing_config FOR ALL
  USING (tenant_id = get_tenant_id());

COMMIT;
