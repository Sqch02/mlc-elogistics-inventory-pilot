-- Fix: RPC detect_shopify_anomalies was timing out on 6 months of data
-- Reduced to 7 days to keep query fast
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
      items.item->>'sku' as raw_sku,
      items.item->>'description' as raw_description,
      COALESCE((items.item->>'quantity')::int, 1) as qty
    FROM shipments s
    CROSS JOIN LATERAL jsonb_array_elements(s.raw_json->'parcel_items') AS items(item)
    WHERE s.tenant_id = p_tenant_id
      AND s.is_return = false
      AND s.shipped_at >= NOW() - INTERVAL '7 days'
  ),
  anomalies AS (
    SELECT *,
      CASE
        WHEN raw_description ~ '^#[0-9]+$' THEN 'order_ref_as_description'
        WHEN (raw_sku IS NULL OR raw_sku = '') AND raw_description IS NOT NULL AND raw_description != '' THEN 'empty_sku'
        WHEN raw_sku ~ ' ' THEN 'sku_with_spaces'
        WHEN raw_sku ~ '[éèêàùçôâîïüÉÈÊÀÙÇÔÂÎÏÜ]' THEN 'sku_with_accents'
      END as anomaly_type
    FROM shopify_items
  )
  SELECT
    anomaly_type::text,
    raw_sku::text,
    raw_description::text,
    COUNT(*)::bigint,
    SUM(qty)::bigint,
    (array_agg(order_ref ORDER BY order_ref DESC))[1:5]::text[] as sample_order_refs
  FROM anomalies
  WHERE anomaly_type IS NOT NULL
  GROUP BY anomaly_type, raw_sku, raw_description
  ORDER BY SUM(qty) DESC;
$$;
