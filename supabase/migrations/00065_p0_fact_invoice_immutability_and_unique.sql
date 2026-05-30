-- P0 Fact: Invoice immutability trigger + UNIQUE invoice_number.
-- Defense in depth for French fiscal compliance: a sent/paid invoice can no
-- longer be silently rewritten by /api/invoices/generate or any other code path.
-- Service role (auth.uid IS NULL) bypasses for legitimate server-side corrections.

CREATE OR REPLACE FUNCTION public.guard_invoice_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  v_status := OLD.status;

  IF v_status IN ('sent', 'paid')
     AND NOT public.is_super_admin()
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice % is in status % and cannot be modified - create an avoir instead', OLD.invoice_number, v_status
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

DROP TRIGGER IF EXISTS invoices_monthly_immutability ON public.invoices_monthly;
CREATE TRIGGER invoices_monthly_immutability
  BEFORE UPDATE OR DELETE ON public.invoices_monthly
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_immutability();

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_monthly_tenant_number_unique
  ON public.invoices_monthly (tenant_id, invoice_number)
  WHERE invoice_number IS NOT NULL;
