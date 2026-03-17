-- Performance indexes for analytics RPC functions and common query patterns

-- Speeds up shipment_items lookups by tenant + SKU (used by analytics_sku_sales, get_sku_consumption_metrics)
CREATE INDEX IF NOT EXISTS idx_shipment_items_tenant_sku
  ON shipment_items(tenant_id, sku_id);

-- Speeds up shipment queries filtered by tenant + date, covering cost and pricing columns (used by analytics_monthly_shipments, get_daily_shipments_aggregated, shipment stats)
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_shipped_cost
  ON shipments(tenant_id, shipped_at) INCLUDE (computed_cost_eur, pricing_status);

-- Speeds up stock snapshot lookups by tenant + current quantity (used by stock health dashboard)
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_tenant_qty
  ON stock_snapshots(tenant_id, qty_current);
