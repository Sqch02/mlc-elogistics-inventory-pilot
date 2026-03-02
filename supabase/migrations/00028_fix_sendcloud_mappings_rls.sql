-- Fix: Enable RLS on sendcloud_sku_mappings (was missing)
ALTER TABLE sendcloud_sku_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant mappings" ON sendcloud_sku_mappings
  FOR SELECT USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());

CREATE POLICY "Users can insert own tenant mappings" ON sendcloud_sku_mappings
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id() OR public.is_super_admin());

CREATE POLICY "Users can update own tenant mappings" ON sendcloud_sku_mappings
  FOR UPDATE USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());

CREATE POLICY "Users can delete own tenant mappings" ON sendcloud_sku_mappings
  FOR DELETE USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());
