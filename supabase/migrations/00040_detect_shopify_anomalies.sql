-- Detect Shopify data anomalies (user-fixable in Shopify admin)
--
-- Scans shipments.raw_json->parcel_items for common data-entry mistakes:
--   - order_ref_as_description: description is a bare order ref (e.g. "#470232")
--   - empty_sku: SKU field left empty while description is present
--   - sku_with_spaces: SKU contains a space (likely a product name typed in the SKU field)
--   - sku_with_accents: SKU contains French accents (almost certainly not a real SKU)
--
-- Results are grouped and ordered by total affected quantity so users can prioritise fixes.

CREATE OR REPLACE FUNCTION detect_shopify_anomalies(p_tenant_id UUID)
RETURNS TABLE (
  anomaly_type TEXT,
  raw_sku TEXT,
  raw_description TEXT,
  nb_occurrences BIGINT,
  total_qty BIGINT,
  sample_order_refs TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH shopify_items AS (
    SELECT
      s.order_ref,
      items.item->>'sku' AS raw_sku,
      items.item->>'description' AS raw_description,
      COALESCE((items.item->>'quantity')::int, 1) AS qty
    FROM shipments s
    CROSS JOIN LATERAL jsonb_array_elements(s.raw_json->'parcel_items') AS items(item)
    WHERE s.tenant_id = p_tenant_id
      AND s.is_return = false
      AND s.shipped_at >= NOW() - INTERVAL '6 months'
      AND (s.status_message IS NULL
           OR s.status_message NOT IN ('Cancelled', 'Cancelled - customer', 'On Hold', 'Unfulfilled'))
  ),
  classified AS (
    SELECT
      raw_sku,
      raw_description,
      qty,
      order_ref,
      CASE
        WHEN raw_description ~ '^#[0-9]+$' THEN 'order_ref_as_description'
        WHEN (raw_sku IS NULL OR raw_sku = '')
             AND raw_description IS NOT NULL AND raw_description <> '' THEN 'empty_sku'
        WHEN raw_sku ~ ' ' THEN 'sku_with_spaces'
        WHEN raw_sku ~ '[éèêàùçôâîïüÉÈÊÀÙÇÔÂÎÏÜ]' THEN 'sku_with_accents'
      END AS anomaly_type
    FROM shopify_items
  )
  SELECT
    anomaly_type::text,
    raw_sku::text,
    raw_description::text,
    COUNT(*)::bigint AS nb_occurrences,
    SUM(qty)::bigint AS total_qty,
    (array_agg(order_ref ORDER BY order_ref DESC))[1:5]::text[] AS sample_order_refs
  FROM classified
  WHERE anomaly_type IS NOT NULL
  GROUP BY anomaly_type, raw_sku, raw_description
  ORDER BY SUM(qty) DESC;
$$;

GRANT EXECUTE ON FUNCTION detect_shopify_anomalies(UUID) TO service_role, authenticated;
