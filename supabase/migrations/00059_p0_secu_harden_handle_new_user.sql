-- P0 Security: Harden handle_new_user trigger.
-- BEFORE: defaults to first tenant in DB, role='ops'. No raw_user_meta_data read.
--   → If Supabase signups are enabled, anyone can join the first tenant as 'ops'.
-- AFTER:
--   1. Reject signups if no invitation exists for the email.
--   2. Honor raw_user_meta_data only for non-privileged roles (ops/sav/client/admin).
--   3. NEVER assign super_admin via this trigger.
-- Also fixes trigger_remap_on_mapping_change to pass LIMIT 2000 (audit P1).

CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'ops', 'sav', 'client')),
  invited_by uuid REFERENCES auth.users(id),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_invitations_email_unused
  ON public.tenant_invitations (lower(email)) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant
  ON public.tenant_invitations (tenant_id);

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_invitations_super_admin_all ON public.tenant_invitations;
CREATE POLICY tenant_invitations_super_admin_all ON public.tenant_invitations
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation RECORD;
  v_meta_tenant_id uuid;
  v_meta_role text;
  v_tenant_id uuid;
  v_role text;
BEGIN
  SELECT * INTO v_invitation
  FROM tenant_invitations
  WHERE lower(email) = lower(NEW.email)
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_invitation.id IS NOT NULL THEN
    v_tenant_id := v_invitation.tenant_id;
    v_role := v_invitation.role;
    UPDATE tenant_invitations SET used_at = now() WHERE id = v_invitation.id;
  ELSE
    v_meta_tenant_id := NULLIF(NEW.raw_user_meta_data->>'tenant_id', '')::uuid;
    v_meta_role := NULLIF(NEW.raw_user_meta_data->>'role', '');

    IF v_meta_tenant_id IS NOT NULL
       AND v_meta_role IN ('admin', 'ops', 'sav', 'client')
       AND EXISTS (SELECT 1 FROM tenants WHERE id = v_meta_tenant_id) THEN
      v_tenant_id := v_meta_tenant_id;
      v_role := v_meta_role;
    ELSE
      RAISE EXCEPTION 'No invitation found for email % and signups are disabled', NEW.email
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_role = 'super_admin' THEN
    v_role := 'admin';
  END IF;

  INSERT INTO profiles (id, tenant_id, email, role)
  VALUES (NEW.id, v_tenant_id, NEW.email, v_role);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_remap_on_mapping_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM remap_unmapped_items(NEW.tenant_id, 2000);
  RETURN NEW;
END;
$function$;
