-- Fix: le trigger d'immutabilite 00065 bloquait aussi la transition legitime
-- sent -> paid ("Marquer payee") pour les utilisateurs non super-admin
-- (/api/invoices/[id]/status utilise la session, auth.uid() non nul). On autorise
-- EXPLICITEMENT sent -> paid quand AUCUN autre champ ne change. Le reste (edition
-- montants, retour arriere, DELETE d'une facture sent/paid) reste bloque.
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
    IF TG_OP = 'UPDATE'
       AND OLD.status = 'sent'
       AND NEW.status = 'paid'
       AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Invoice % is in status % and cannot be modified - create an avoir instead', OLD.invoice_number, v_status
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
