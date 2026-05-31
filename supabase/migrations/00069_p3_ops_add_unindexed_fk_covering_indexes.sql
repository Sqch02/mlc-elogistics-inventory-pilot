-- P3 Ops: add covering indexes for foreign keys that the advisor flagged as
-- unindexed (unindexed_foreign_keys). Each one would otherwise force a seq scan
-- on the FK target table when the referenced row is deleted.

CREATE INDEX IF NOT EXISTS idx_dismissed_anomalies_dismissed_by
  ON public.dismissed_anomalies (dismissed_by);

CREATE INDEX IF NOT EXISTS idx_inbound_restock_created_by
  ON public.inbound_restock (created_by);

CREATE INDEX IF NOT EXISTS idx_inbound_restock_reviewed_by
  ON public.inbound_restock (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_returns_restocked_by
  ON public.returns (restocked_by);

CREATE INDEX IF NOT EXISTS idx_sendcloud_sku_mappings_sku_id
  ON public.sendcloud_sku_mappings (sku_id);

CREATE INDEX IF NOT EXISTS idx_sku_mappings_created_by
  ON public.sku_mappings (created_by);

CREATE INDEX IF NOT EXISTS idx_sku_mappings_target_sku_id
  ON public.sku_mappings (target_sku_id);

CREATE INDEX IF NOT EXISTS idx_unmapped_items_resolved_sku_id
  ON public.unmapped_items (resolved_sku_id);
