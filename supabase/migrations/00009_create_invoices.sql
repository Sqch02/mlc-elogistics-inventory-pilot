-- Migration: Create invoice tables
-- Description: Monthly invoices and invoice lines

-- Invoice status enum
CREATE TYPE invoice_status AS ENUM ('draft', 'validated');

-- Monthly invoices
CREATE TABLE IF NOT EXISTS invoices_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    status invoice_status NOT NULL DEFAULT 'draft',
    total_eur NUMERIC(12, 2) NOT NULL DEFAULT 0,
    missing_pricing_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT month_format CHECK (month ~ '^\d{4}-\d{2}$')
);

-- Unique constraint: one invoice per tenant/month
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_monthly_tenant_month
    ON invoices_monthly(tenant_id, month);

CREATE INDEX IF NOT EXISTS idx_invoices_monthly_tenant ON invoices_monthly(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_monthly_status ON invoices_monthly(tenant_id, status);

-- Invoice lines (grouped by carrier and weight tier)
CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices_monthly(id) ON DELETE CASCADE,
    carrier TEXT NOT NULL,
    weight_min_grams INTEGER NOT NULL,
    weight_max_grams INTEGER NOT NULL,
    shipment_count INTEGER NOT NULL DEFAULT 0,
    total_eur NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_tenant ON invoice_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- Unique: one line per invoice/carrier/weight tier
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_lines_unique
    ON invoice_lines(invoice_id, carrier, weight_min_grams, weight_max_grams);

COMMENT ON TABLE invoices_monthly IS 'Monthly billing invoices';
COMMENT ON COLUMN invoices_monthly.month IS 'Billing month in YYYY-MM format';
COMMENT ON COLUMN invoices_monthly.missing_pricing_count IS 'Count of shipments without pricing';
COMMENT ON TABLE invoice_lines IS 'Invoice line items grouped by carrier and weight tier';
