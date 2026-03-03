-- Add error detection fields to shipments
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS has_error boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS error_message text;

-- Index for quick filtering of shipments with errors
CREATE INDEX IF NOT EXISTS idx_shipments_has_error ON shipments(tenant_id, has_error) WHERE has_error = true;

-- Comment
COMMENT ON COLUMN shipments.has_error IS 'True if Sendcloud reported validation/processing errors for this shipment';
COMMENT ON COLUMN shipments.error_message IS 'Error message from Sendcloud if has_error is true';
