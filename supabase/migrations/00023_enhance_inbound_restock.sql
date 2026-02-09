-- Enhance inbound_restock with workflow fields
ALTER TABLE inbound_restock
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'received')),
  ADD COLUMN IF NOT EXISTS accepted_qty INTEGER,
  ADD COLUMN IF NOT EXISTS supplier TEXT,
  ADD COLUMN IF NOT EXISTS batch_reference TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Migrate existing data: received=true -> status='received'
UPDATE inbound_restock SET status = 'received' WHERE received = true AND status = 'pending';

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_inbound_status ON inbound_restock(tenant_id, status);
