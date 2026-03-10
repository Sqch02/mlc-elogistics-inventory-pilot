-- Migration: Fix invoice schema for zone-based grouping
-- The original invoice_lines schema had NOT NULL on carrier/weights
-- and a unique index that conflicts with return lines

-- 1. Make carrier and weight columns nullable (for non-shipping lines)
ALTER TABLE invoice_lines ALTER COLUMN carrier DROP NOT NULL;
ALTER TABLE invoice_lines ALTER COLUMN weight_min_grams DROP NOT NULL;
ALTER TABLE invoice_lines ALTER COLUMN weight_max_grams DROP NOT NULL;

-- 2. Add columns if they don't exist yet
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS line_type TEXT;
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS unit_price_eur NUMERIC(10, 2);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12, 2);

-- 3. Drop the old unique index (carrier+weight no longer unique with return lines)
DROP INDEX IF EXISTS idx_invoice_lines_unique;

-- 4. Add missing columns to invoices_monthly
ALTER TABLE invoices_monthly ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE invoices_monthly ADD COLUMN IF NOT EXISTS subtotal_ht NUMERIC(12, 2);
ALTER TABLE invoices_monthly ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12, 2);
ALTER TABLE invoices_monthly ADD COLUMN IF NOT EXISTS total_ttc NUMERIC(12, 2);
ALTER TABLE invoices_monthly ADD COLUMN IF NOT EXISTS storage_m3 NUMERIC(10, 2);
ALTER TABLE invoices_monthly ADD COLUMN IF NOT EXISTS reception_quarters INTEGER;
ALTER TABLE invoices_monthly ADD COLUMN IF NOT EXISTS returns_count INTEGER;
ALTER TABLE invoices_monthly ADD COLUMN IF NOT EXISTS free_returns_count INTEGER;

-- 5. Add 'sent' and 'paid' to invoice_status enum if not already there
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sent' AND enumtypid = 'invoice_status'::regtype) THEN
    ALTER TYPE invoice_status ADD VALUE 'sent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'paid' AND enumtypid = 'invoice_status'::regtype) THEN
    ALTER TYPE invoice_status ADD VALUE 'paid';
  END IF;
END$$;
