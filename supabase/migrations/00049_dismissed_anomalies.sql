-- Migration 00049: Table to mark anomalies as "fixed" (dismissed by user).
--
-- Historical shipments still contain old raw_json with broken SKUs, so anomalies
-- would persist forever after the user fixes things in Shopify. This table lets
-- the user manually dismiss anomalies once they've applied the fix.

CREATE TABLE IF NOT EXISTS dismissed_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  raw_sku TEXT,
  raw_description TEXT,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dismissed_anomalies_unique
  ON dismissed_anomalies(tenant_id, anomaly_type, COALESCE(raw_sku, ''), COALESCE(raw_description, ''));

CREATE INDEX IF NOT EXISTS idx_dismissed_anomalies_tenant
  ON dismissed_anomalies(tenant_id);

ALTER TABLE dismissed_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY dismissed_anomalies_select ON dismissed_anomalies
  FOR SELECT USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());
CREATE POLICY dismissed_anomalies_insert ON dismissed_anomalies
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id() OR public.is_super_admin());
CREATE POLICY dismissed_anomalies_delete ON dismissed_anomalies
  FOR DELETE USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());

GRANT SELECT, INSERT, DELETE ON dismissed_anomalies TO authenticated;
GRANT ALL ON dismissed_anomalies TO service_role;

-- detect_shopify_anomalies now filters out dismissed (tenant, type, sku, description) combos
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
  SELECT
    a.anomaly_type::text,
    a.raw_sku::text,
    a.raw_description::text,
    COUNT(*)::bigint AS nb_occurrences,
    SUM(a.qty)::bigint AS total_qty,
    (array_agg(a.order_ref ORDER BY a.shipped_at DESC) FILTER (WHERE a.order_ref IS NOT NULL))[1:100]::text[]
      AS sample_order_refs
  FROM mv_shopify_anomaly_items a
  WHERE a.tenant_id = p_tenant_id
    AND a.anomaly_type IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM dismissed_anomalies d
      WHERE d.tenant_id = a.tenant_id
        AND d.anomaly_type = a.anomaly_type
        AND COALESCE(d.raw_sku, '') = COALESCE(a.raw_sku, '')
        AND COALESCE(d.raw_description, '') = COALESCE(a.raw_description, '')
    )
  GROUP BY a.anomaly_type, a.raw_sku, a.raw_description
  ORDER BY SUM(a.qty) DESC;
$$;

GRANT EXECUTE ON FUNCTION detect_shopify_anomalies TO service_role, authenticated;
