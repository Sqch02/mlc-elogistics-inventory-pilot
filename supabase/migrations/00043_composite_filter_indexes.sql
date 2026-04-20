-- Migration 00043: Composite indexes for shipments list filters and dashboard queries
--
-- Context: the shipments list page and dashboard rely on filters by tenant + shipped_at,
-- combined with status_id / pricing_status / carrier. The existing single-column indexes
-- force seq scans when multiple filters apply on ~126k shipments.
--
-- Strategy: compound index on (tenant_id, shipped_at DESC) with INCLUDE clause covering
-- the columns actually read, so the planner can use index-only scans.

-- Primary shipments filter: tenant + date range + common filter columns covered
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_shipped_covering
  ON shipments(tenant_id, shipped_at DESC)
  INCLUDE (status_id, pricing_status, carrier, computed_cost_eur, total_value, is_return);

-- "Pending" filter: status_id IS NULL scan
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_pending
  ON shipments(tenant_id, shipped_at DESC)
  WHERE status_id IS NULL;

-- Claims aggregation by decided_at (used by analytics_monthly_shipments + get_monthly_indemnities)
CREATE INDEX IF NOT EXISTS idx_claims_tenant_decided
  ON claims(tenant_id, decided_at DESC)
  INCLUDE (status, indemnity_eur);

-- Shipment items: tenant + shipment composite for list page N+1 join
CREATE INDEX IF NOT EXISTS idx_shipment_items_tenant_shipment
  ON shipment_items(tenant_id, shipment_id);

-- unmapped_items: only unresolved rows for the mapping page
CREATE INDEX IF NOT EXISTS idx_unmapped_items_unresolved_recent
  ON unmapped_items(tenant_id, created_at DESC)
  WHERE resolved_at IS NULL;
