-- Migration: Create Row Level Security policies
-- Description: RLS policies for multi-tenant data isolation

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_restock ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- TENANTS: Only super_admin can see all tenants
-- ============================================
CREATE POLICY tenants_select ON tenants
    FOR SELECT USING (
        auth.is_super_admin() OR id = auth.tenant_id()
    );

CREATE POLICY tenants_insert ON tenants
    FOR INSERT WITH CHECK (auth.is_super_admin());

CREATE POLICY tenants_update ON tenants
    FOR UPDATE USING (auth.is_super_admin());

CREATE POLICY tenants_delete ON tenants
    FOR DELETE USING (auth.is_super_admin());

-- ============================================
-- PROFILES: Users see their own tenant's profiles
-- ============================================
CREATE POLICY profiles_select ON profiles
    FOR SELECT USING (
        auth.is_super_admin() OR tenant_id = auth.tenant_id()
    );

CREATE POLICY profiles_insert ON profiles
    FOR INSERT WITH CHECK (
        auth.is_super_admin() OR tenant_id = auth.tenant_id()
    );

CREATE POLICY profiles_update ON profiles
    FOR UPDATE USING (
        auth.is_super_admin() OR (tenant_id = auth.tenant_id() AND id = auth.uid())
    );

-- ============================================
-- TENANT-SCOPED TABLES: Standard policies
-- ============================================

-- Macro for creating standard tenant policies
-- All operations are scoped to tenant_id = auth.tenant_id()

-- SKUs
CREATE POLICY skus_select ON skus FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY skus_insert ON skus FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY skus_update ON skus FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY skus_delete ON skus FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Stock snapshots
CREATE POLICY stock_snapshots_select ON stock_snapshots FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY stock_snapshots_insert ON stock_snapshots FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY stock_snapshots_update ON stock_snapshots FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY stock_snapshots_delete ON stock_snapshots FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Inbound restock
CREATE POLICY inbound_restock_select ON inbound_restock FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY inbound_restock_insert ON inbound_restock FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY inbound_restock_update ON inbound_restock FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY inbound_restock_delete ON inbound_restock FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Bundles
CREATE POLICY bundles_select ON bundles FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY bundles_insert ON bundles FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY bundles_update ON bundles FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY bundles_delete ON bundles FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Bundle components
CREATE POLICY bundle_components_select ON bundle_components FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY bundle_components_insert ON bundle_components FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY bundle_components_update ON bundle_components FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY bundle_components_delete ON bundle_components FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Locations
CREATE POLICY locations_select ON locations FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY locations_insert ON locations FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY locations_update ON locations FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY locations_delete ON locations FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Location assignments
CREATE POLICY location_assignments_select ON location_assignments FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY location_assignments_insert ON location_assignments FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY location_assignments_update ON location_assignments FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY location_assignments_delete ON location_assignments FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Shipments
CREATE POLICY shipments_select ON shipments FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY shipments_insert ON shipments FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY shipments_update ON shipments FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY shipments_delete ON shipments FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Shipment items
CREATE POLICY shipment_items_select ON shipment_items FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY shipment_items_insert ON shipment_items FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY shipment_items_update ON shipment_items FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY shipment_items_delete ON shipment_items FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Pricing rules
CREATE POLICY pricing_rules_select ON pricing_rules FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY pricing_rules_insert ON pricing_rules FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY pricing_rules_update ON pricing_rules FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY pricing_rules_delete ON pricing_rules FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Invoices monthly
CREATE POLICY invoices_monthly_select ON invoices_monthly FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY invoices_monthly_insert ON invoices_monthly FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY invoices_monthly_update ON invoices_monthly FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY invoices_monthly_delete ON invoices_monthly FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Invoice lines
CREATE POLICY invoice_lines_select ON invoice_lines FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY invoice_lines_insert ON invoice_lines FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY invoice_lines_update ON invoice_lines FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY invoice_lines_delete ON invoice_lines FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Claims
CREATE POLICY claims_select ON claims FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY claims_insert ON claims FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY claims_update ON claims FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY claims_delete ON claims FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());

-- Sync runs
CREATE POLICY sync_runs_select ON sync_runs FOR SELECT USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY sync_runs_insert ON sync_runs FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY sync_runs_update ON sync_runs FOR UPDATE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
CREATE POLICY sync_runs_delete ON sync_runs FOR DELETE USING (tenant_id = auth.tenant_id() OR auth.is_super_admin());
