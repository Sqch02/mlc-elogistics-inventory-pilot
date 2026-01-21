-- =============================================
-- Migration: Create Audit Logs Table
-- Description: Track all important actions in the system
-- =============================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  entity_type VARCHAR(50) NOT NULL, -- 'claim', 'sku', 'pricing_rule', 'shipment', etc.
  entity_id UUID, -- ID of the affected entity
  old_value JSONB, -- Previous state (for updates/deletes)
  new_value JSONB, -- New state (for creates/updates)
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  metadata JSONB, -- Additional context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see audit logs for their tenant
CREATE POLICY "Users can view own tenant audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (tenant_id = public.get_tenant_id());

-- No INSERT policy needed - service role bypasses RLS
-- This prevents clients from spoofing audit entries
-- Only the admin client (service role) in src/lib/audit.ts can insert

-- No one can update or delete audit logs (immutable)
-- Audit logs should never be modified

-- Add comment for documentation
COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail of all important actions in the system';
COMMENT ON COLUMN public.audit_logs.action IS 'Action type: create, update, delete';
COMMENT ON COLUMN public.audit_logs.entity_type IS 'Entity type: claim, sku, pricing_rule, shipment, bundle, location, etc.';
