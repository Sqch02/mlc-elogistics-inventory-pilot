-- Drop old view
DROP VIEW IF EXISTS v_physical_shipment_items CASCADE;

-- Create materialized version
CREATE MATERIALIZED VIEW v_physical_shipment_items AS
WITH decomposed AS (
  SELECT
    si.tenant_id,
    si.shipment_id,
    bc.component_sku_id AS sku_id,
    si.qty * bc.qty_component AS physical_qty,
    si.qty AS original_qty,
    TRUE AS was_bundle
  FROM shipment_items si
  JOIN bundles b ON b.bundle_sku_id = si.sku_id AND b.tenant_id = si.tenant_id
  JOIN bundle_components bc ON bc.bundle_id = b.id
  UNION ALL
  SELECT
    si.tenant_id,
    si.shipment_id,
    si.sku_id,
    si.qty AS physical_qty,
    si.qty AS original_qty,
    FALSE AS was_bundle
  FROM shipment_items si
  WHERE NOT EXISTS (
    SELECT 1 FROM bundles b WHERE b.bundle_sku_id = si.sku_id AND b.tenant_id = si.tenant_id
  )
)
SELECT
  d.tenant_id,
  d.shipment_id,
  d.sku_id,
  SUM(d.physical_qty)::int AS physical_qty,
  SUM(d.original_qty)::int AS original_qty,
  bool_or(d.was_bundle) AS includes_bundle,
  s.shipped_at,
  s.is_return,
  s.status_message
FROM decomposed d
JOIN shipments s ON s.id = d.shipment_id
GROUP BY d.tenant_id, d.shipment_id, d.sku_id, s.shipped_at, s.is_return, s.status_message;

-- Critical indexes for fast reads
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_phys_items_pk ON v_physical_shipment_items(tenant_id, shipment_id, sku_id);
CREATE INDEX IF NOT EXISTS idx_mv_phys_items_tenant_date ON v_physical_shipment_items(tenant_id, shipped_at DESC) WHERE is_return = false;
CREATE INDEX IF NOT EXISTS idx_mv_phys_items_tenant_sku ON v_physical_shipment_items(tenant_id, sku_id);

-- Function to refresh
CREATE OR REPLACE FUNCTION refresh_physical_items_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_physical_shipment_items;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_physical_items_view TO service_role;
GRANT SELECT ON v_physical_shipment_items TO service_role, authenticated;

-- Initial population
REFRESH MATERIALIZED VIEW v_physical_shipment_items;
