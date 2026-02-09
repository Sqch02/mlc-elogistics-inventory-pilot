-- Create stock_movements table (referenced in code but never created)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sku_id UUID NOT NULL REFERENCES skus(id),
  qty_before INTEGER NOT NULL DEFAULT 0,
  qty_after INTEGER NOT NULL DEFAULT 0,
  adjustment INTEGER NOT NULL DEFAULT 0,
  movement_type TEXT NOT NULL DEFAULT 'manual',
  reason TEXT,
  reference_id UUID,
  reference_type TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_sku ON stock_movements(sku_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(tenant_id, created_at DESC);

-- RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_movements_tenant_policy ON stock_movements
  FOR ALL
  USING (
    tenant_id = public.get_tenant_id()
    OR public.is_super_admin()
  );
