-- P0 Cron: wrapper RPCs that map a tenant UUID to a stable bigint advisory
-- lock key. Lets the cron call pg_try_advisory_lock/pg_advisory_unlock
-- through supabase-js rpc() without having to ship signed-bigint values
-- through JSON.

CREATE OR REPLACE FUNCTION public.try_cron_tenant_lock(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key bigint;
BEGIN
  v_key := ('x' || substr(md5('sendcloud_sync_' || p_tenant_id::text), 1, 15))::bit(60)::bigint;
  RETURN pg_try_advisory_lock(v_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_cron_tenant_lock(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key bigint;
BEGIN
  v_key := ('x' || substr(md5('sendcloud_sync_' || p_tenant_id::text), 1, 15))::bit(60)::bigint;
  RETURN pg_advisory_unlock(v_key);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.try_cron_tenant_lock(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_cron_tenant_lock(uuid) FROM anon, authenticated;
