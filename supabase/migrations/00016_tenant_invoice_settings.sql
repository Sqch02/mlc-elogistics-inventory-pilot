-- Migration: Add invoice settings to tenant_settings
-- Description: Per-tenant invoice configuration

-- Add invoice-related columns to tenant_settings
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'FAC';
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS invoice_next_number INTEGER DEFAULT 1;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS bank_details TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(5,2) DEFAULT 20.00;

-- Comments for documentation
COMMENT ON COLUMN tenant_settings.invoice_prefix IS 'Prefix for invoice numbers (e.g., FAC, INV)';
COMMENT ON COLUMN tenant_settings.invoice_next_number IS 'Next invoice number to use (auto-incremented)';
COMMENT ON COLUMN tenant_settings.payment_terms IS 'Payment terms text for invoices';
COMMENT ON COLUMN tenant_settings.bank_details IS 'Bank account details (IBAN/BIC) for payments';
COMMENT ON COLUMN tenant_settings.default_vat_rate IS 'Default VAT rate in percent (e.g., 20.00)';
