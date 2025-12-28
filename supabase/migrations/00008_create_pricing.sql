-- Migration: Create pricing_rules table
-- Description: Transport pricing grid by carrier and weight tier

CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    carrier TEXT NOT NULL,
    weight_min_grams INTEGER NOT NULL,
    weight_max_grams INTEGER NOT NULL,
    price_eur NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT weight_range_valid CHECK (weight_min_grams < weight_max_grams),
    CONSTRAINT weight_min_non_negative CHECK (weight_min_grams >= 0),
    CONSTRAINT price_non_negative CHECK (price_eur >= 0)
);

-- Unique constraint: one price per carrier/weight tier
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_rules_unique
    ON pricing_rules(tenant_id, carrier, weight_min_grams, weight_max_grams);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_tenant ON pricing_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_carrier ON pricing_rules(tenant_id, carrier);

COMMENT ON TABLE pricing_rules IS 'Transport pricing grid by carrier and weight tier';
COMMENT ON COLUMN pricing_rules.weight_min_grams IS 'Minimum weight (inclusive) in grams';
COMMENT ON COLUMN pricing_rules.weight_max_grams IS 'Maximum weight (exclusive) in grams';
COMMENT ON COLUMN pricing_rules.price_eur IS 'Price in EUR for this tier';

-- Function to find price for a shipment
-- Rule: weight_min_grams <= weight < weight_max_grams
CREATE OR REPLACE FUNCTION get_shipping_price(
    p_tenant_id UUID,
    p_carrier TEXT,
    p_weight_grams INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    v_price NUMERIC(10, 2);
BEGIN
    SELECT price_eur INTO v_price
    FROM pricing_rules
    WHERE tenant_id = p_tenant_id
      AND carrier = p_carrier
      AND weight_min_grams <= p_weight_grams
      AND weight_max_grams > p_weight_grams
    LIMIT 1;

    RETURN v_price;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_shipping_price IS 'Returns price for carrier/weight, NULL if no matching tier';
