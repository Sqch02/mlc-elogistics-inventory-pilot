-- Add house_number column to shipments table
-- Required by Sendcloud for some carriers (e.g., Belgium)

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS house_number TEXT;

-- Add comment
COMMENT ON COLUMN shipments.house_number IS 'Street number, required by some carriers';
