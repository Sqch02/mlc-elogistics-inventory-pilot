-- Convertir le role de l'invitation vers le type de la colonne.
--
-- `handle_new_user` inserait le role tel quel :
--
--   INSERT INTO profiles (id, tenant_id, email, role)
--   VALUES (NEW.id, v_invitation.tenant_id, NEW.email, v_invitation.role);
--
-- `tenant_invitations.role` est du TEXTE, `profiles.role` est l'ENUM
-- `user_role`. PL/pgSQL ne convertit pas l'un vers l'autre tout seul :
--
--   ERROR 42804 : column "role" is of type user_role but expression is of
--   type text
--
-- L'insertion echouait donc, le declencheur annulait la creation du compte,
-- et le service d'authentification renvoyait « Database error creating new
-- user ». Message generique, qui ne designait ni la colonne ni la table :
-- c'est ce qui a rendu la panne opaque.
--
-- Aucun utilisateur ne pouvait etre cree. Constate le 21/09 en voulant
-- ajouter les comptes de VITALIENCE, reproduit en rejouant l'insertion dans
-- une transaction annulee.
--
-- Les quatre valeurs acceptees par tenant_invitations (admin, ops, sav,
-- client) existent toutes dans l'enum : la conversion ne peut pas echouer
-- sur une invitation valide.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT * INTO v_invitation
  FROM tenant_invitations
  WHERE lower(email) = lower(NEW.email)
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'No invitation found for email % - admin must create a tenant_invitations row first', NEW.email
      USING ERRCODE = '23514';
  END IF;

  IF v_invitation.role = 'super_admin' THEN
    -- Belt-and-suspenders: tenant_invitations.role has CHECK constraint excluding
    -- super_admin, but enforce again here.
    RAISE EXCEPTION 'super_admin role cannot be assigned via invitation';
  END IF;

  UPDATE tenant_invitations SET used_at = now() WHERE id = v_invitation.id;

  INSERT INTO profiles (id, tenant_id, email, role)
  VALUES (NEW.id, v_invitation.tenant_id, NEW.email, v_invitation.role::public.user_role);

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
