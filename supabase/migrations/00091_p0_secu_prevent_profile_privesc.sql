-- P0 SECURITY (audit 17/07/2026, verifie en prod): la policy RLS
-- profiles_update_optimized a WITH CHECK = NULL, donc Postgres reutilise le USING
-- (qui verifie seulement la propriete de la ligne, PAS quelles colonnes changent).
-- Combine aux grants table-level UPDATE de 'authenticated', n'importe quel compte
-- authentifie pouvait faire `update profiles set role='super_admin' where id=<self>`
-- et prendre le controle multi-tenant complet.
--
-- Fix: un trigger BEFORE INSERT OR UPDATE qui bloque les appelants bas-privilege
-- (roles Postgres 'authenticated'/'anon' via PostgREST) de changer role/tenant_id
-- ou de creer un profil avec un role privilegie. Les operations admin passent par
-- le service_role (createAdminClient, bypass RLS) -> current_user='service_role',
-- non bloque. Les migrations (postgres/supabase_admin) et les sessions super_admin
-- passent aussi. Aucun code applicatif ne met a jour profiles.role via session user
-- (verifie: grep vide), donc ce trigger ne casse aucun flux legitime.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- N'agir que pour les appelants bas-privilege (PostgREST authenticated/anon).
  -- service_role, postgres, supabase_admin et super_admin passent librement.
  IF current_user IN ('authenticated', 'anon')
     AND NOT COALESCE(public.is_super_admin(), false) THEN

    IF TG_OP = 'UPDATE'
       AND (NEW.role IS DISTINCT FROM OLD.role
            OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) THEN
      RAISE EXCEPTION 'Modification de role/tenant_id non autorisee'
        USING ERRCODE = '42501', HINT = 'Privilege escalation blocked';

    ELSIF TG_OP = 'INSERT'
       AND NEW.role IN ('super_admin', 'admin', 'ops', 'sav') THEN
      RAISE EXCEPTION 'Creation de profil avec role privilegie non autorisee'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_privesc ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_privesc
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
