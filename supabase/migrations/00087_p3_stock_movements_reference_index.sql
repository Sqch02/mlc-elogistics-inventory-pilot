-- Index couvrant reference_type/reference_id (cron dedup, /api/stock/recalculate).
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
  ON public.stock_movements (tenant_id, reference_type, reference_id);
