-- Single source of truth for physical shipment items
-- This view automatically decomposes bundles into physical components.
-- Using this view GUARANTEES that metrics count physical products, not Shopify line items.

CREATE OR REPLACE VIEW v_physical_shipment_items AS
WITH decomposed AS (
  -- Bundles : decomposer en composants physiques
  SELECT
    si.tenant_id,
    si.shipment_id,
    bc.component_sku_id AS sku_id,
    si.qty * bc.qty_component AS physical_qty,
    si.qty AS original_qty,
    TRUE AS was_bundle,
    si.sku_id AS source_bundle_sku_id
  FROM shipment_items si
  JOIN bundles b ON b.bundle_sku_id = si.sku_id AND b.tenant_id = si.tenant_id
  JOIN bundle_components bc ON bc.bundle_id = b.id

  UNION ALL

  -- Articles simples : 1:1
  SELECT
    si.tenant_id,
    si.shipment_id,
    si.sku_id,
    si.qty AS physical_qty,
    si.qty AS original_qty,
    FALSE AS was_bundle,
    NULL::uuid AS source_bundle_sku_id
  FROM shipment_items si
  WHERE NOT EXISTS (
    SELECT 1 FROM bundles b
    WHERE b.bundle_sku_id = si.sku_id AND b.tenant_id = si.tenant_id
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

GRANT SELECT ON v_physical_shipment_items TO service_role, authenticated;

COMMENT ON VIEW v_physical_shipment_items IS
'Single source of truth for physical shipment items. Automatically decomposes bundles into physical components.
Use this view (not shipment_items directly) to count sold units in analytics queries.
Columns: physical_qty = real physical units (bundles decomposed), original_qty = raw Shopify line quantity.';
