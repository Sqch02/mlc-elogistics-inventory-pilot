-- Migration 00048: Aggregated carrier performance RPC
--
-- Replaces the 90-day shipments pagination loop + claims join in /api/dashboard/analytics
-- section 2. Used by the carrier performance table in analytics.

CREATE OR REPLACE FUNCTION get_carrier_performance(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  carrier TEXT,
  shipments BIGINT,
  total_cost NUMERIC,
  avg_cost NUMERIC,
  claims BIGINT,
  claim_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH carrier_shipments AS (
    SELECT
      LOWER(COALESCE(s.carrier, 'unknown')) AS carrier,
      COUNT(*)::bigint AS shipments,
      COALESCE(SUM(s.computed_cost_eur), 0)::numeric(14,2) AS total_cost
    FROM shipments s
    WHERE s.tenant_id = p_tenant_id
      AND s.is_return = false
      AND s.shipped_at >= p_start_date
      AND s.shipped_at <= p_end_date
    GROUP BY LOWER(COALESCE(s.carrier, 'unknown'))
  ),
  carrier_claims AS (
    SELECT
      LOWER(COALESCE(s.carrier, 'unknown')) AS carrier,
      COUNT(*)::bigint AS claims
    FROM claims c
    JOIN shipments s ON s.id = c.shipment_id
    WHERE c.tenant_id = p_tenant_id
      AND c.opened_at >= p_start_date
      AND c.opened_at <= p_end_date
    GROUP BY LOWER(COALESCE(s.carrier, 'unknown'))
  )
  SELECT
    cs.carrier,
    cs.shipments,
    cs.total_cost,
    CASE WHEN cs.shipments > 0
      THEN ROUND((cs.total_cost / cs.shipments)::numeric, 2)
      ELSE 0::numeric
    END AS avg_cost,
    COALESCE(cc.claims, 0)::bigint AS claims,
    CASE WHEN cs.shipments > 0
      THEN ROUND((COALESCE(cc.claims, 0)::numeric / cs.shipments * 100)::numeric, 2)
      ELSE 0::numeric
    END AS claim_rate
  FROM carrier_shipments cs
  LEFT JOIN carrier_claims cc ON cc.carrier = cs.carrier
  ORDER BY cs.shipments DESC;
$$;

GRANT EXECUTE ON FUNCTION get_carrier_performance TO service_role, authenticated;
