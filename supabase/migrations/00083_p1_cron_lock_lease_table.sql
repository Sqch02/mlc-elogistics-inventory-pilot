-- Fix: try/release_cron_tenant_lock utilisaient pg_try_advisory_lock (SESSION-scoped)
-- via deux appels rpc() PostgREST separes (backends differents) -> verrou qui fuit
-- ou ne serialise pas. Remplace par un bail auto-expirant en table. Memes signatures.
CREATE TABLE IF NOT EXISTS public.cron_tenant_locks (
  tenant_id    uuid PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  locked_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cron_tenant_locks ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.try_cron_tenant_lock(p_tenant_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.cron_tenant_locks (tenant_id, locked_until, locked_at)
  VALUES (p_tenant_id, now() + interval '15 minutes', now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET locked_until = EXCLUDED.locked_until, locked_at = EXCLUDED.locked_at
    WHERE cron_tenant_locks.locked_until < now();
  RETURN FOUND;
END;
$function$;
CREATE OR REPLACE FUNCTION public.release_cron_tenant_lock(p_tenant_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.cron_tenant_locks WHERE tenant_id = p_tenant_id;
  RETURN FOUND;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.try_cron_tenant_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_cron_tenant_lock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_cron_tenant_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_cron_tenant_lock(uuid) TO service_role;
