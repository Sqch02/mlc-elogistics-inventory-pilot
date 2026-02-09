-- Add restock validation fields to returns table
-- Returns require human validation before stock is restored

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS restock_status TEXT DEFAULT 'pending'
    CHECK (restock_status IN ('pending', 'validated', 'rejected', 'not_applicable')),
  ADD COLUMN IF NOT EXISTS restock_qty INTEGER,
  ADD COLUMN IF NOT EXISTS restock_note TEXT,
  ADD COLUMN IF NOT EXISTS restocked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS restocked_at TIMESTAMPTZ;

-- Index for filtering returns by restock status
CREATE INDEX IF NOT EXISTS idx_returns_restock_status ON returns(tenant_id, restock_status);

-- Set delivered returns without restock_status to 'pending' (they need review)
-- Non-delivered returns are 'not_applicable' until they arrive
UPDATE returns SET restock_status = 'pending' WHERE status = 'delivered' AND restock_status = 'pending';
UPDATE returns SET restock_status = 'not_applicable' WHERE status != 'delivered' AND restock_status = 'pending';
