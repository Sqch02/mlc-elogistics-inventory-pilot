-- Additional performance indexes identified by audit
CREATE INDEX IF NOT EXISTS idx_claims_tenant_opened_at ON claims(tenant_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_tracking ON shipments(tenant_id, tracking);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_tenant_carrier_dest_weight ON pricing_rules(tenant_id, carrier, destination, weight_min_grams);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_is_return_shipped ON shipments(tenant_id, is_return, shipped_at DESC) INCLUDE (computed_cost_eur);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON profiles(id, role);
