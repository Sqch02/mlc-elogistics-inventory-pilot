-- RPC function to compute shipment stats (sums/counts) server-side
-- Avoids the PostgREST 1000-row default limit that causes wrong stats

CREATE OR REPLACE FUNCTION get_shipment_stats(
  p_tenant_id UUID,
  p_from TEXT DEFAULT NULL,
  p_to TEXT DEFAULT NULL,
  p_carrier TEXT DEFAULT NULL,
  p_pricing_status TEXT DEFAULT NULL,
  p_shipment_status TEXT DEFAULT NULL,
  p_delivery_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_problem_ids INT[] := ARRAY[1002, 1337, 8, 80, 62996, 62992, 62991, 2000];
  v_transit_ids INT[] := ARRAY[1, 3, 7, 12, 22, 91, 92, 62989, 62990];
BEGIN
  SELECT json_build_object(
    'totalCost', COALESCE(SUM(s.computed_cost_eur), 0),
    'totalValue', COALESCE(SUM(s.total_value), 0),
    'missingPricing', COUNT(*) FILTER (WHERE s.pricing_status = 'missing'::pricing_status)
  )
  INTO v_result
  FROM shipments s
  WHERE s.tenant_id = p_tenant_id
    -- Date filters
    AND (p_from IS NULL OR s.shipped_at >= p_from::timestamptz)
    AND (p_to IS NULL OR s.shipped_at <= p_to::timestamptz)
    -- Carrier filter (case-insensitive)
    AND (p_carrier IS NULL OR s.carrier ILIKE p_carrier)
    -- Pricing status filter
    AND (p_pricing_status IS NULL OR s.pricing_status = p_pricing_status::pricing_status)
    -- Shipment status filter
    AND (
      p_shipment_status IS NULL
      OR (p_shipment_status = 'pending' AND s.status_id IS NULL)
      OR (p_shipment_status = 'shipped' AND s.status_id IS NOT NULL)
    )
    -- Delivery status filter
    AND (
      p_delivery_status IS NULL
      OR (p_delivery_status = 'issue' AND p_shipment_status = 'pending' AND s.has_error = true)
      OR (p_delivery_status = 'issue' AND COALESCE(p_shipment_status, '') != 'pending'
          AND s.status_id = ANY(v_problem_ids))
      OR (p_delivery_status = 'delivered' AND s.status_id = 11)
      OR (p_delivery_status = 'in_transit' AND s.status_id = ANY(v_transit_ids))
    )
    -- Search filter
    AND (
      p_search IS NULL
      OR s.order_ref ILIKE '%' || p_search || '%'
      OR s.tracking ILIKE '%' || p_search || '%'
      OR s.sendcloud_id ILIKE '%' || p_search || '%'
    );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shipment_stats TO service_role;
