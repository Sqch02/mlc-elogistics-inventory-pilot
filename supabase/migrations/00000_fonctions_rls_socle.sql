-- Les trois fonctions dont dependent toutes les politiques RLS.
--
-- POURQUOI CE FICHIER EXISTE, ET POURQUOI IL PORTE LE NUMERO 00000
-- Ces fonctions n'existaient QUE dans la base de production. Aucune migration
-- ne les creait. Une base reconstruite depuis ce depot -- reprise apres
-- incident, environnement de recette, poste neuf -- n'en aurait eu aucune.
--
-- Ce n'est pas une gene mineure : 94 politiques RLS reparties sur 28 tables les
-- appellent, c'est-a-dire toute l'isolation entre clients. Et la premiere
-- politique qui s'y refere apparait des la migration 00018 : un fichier ajoute
-- en fin de liste n'aurait donc rien repare, la reconstruction aurait echoue
-- bien avant de l'atteindre. D'ou le numero 00000, qui passe en premier.
--
-- Sur la base existante, ce fichier ne change rien : les corps sont repris
-- MOT POUR MOT de la production, et CREATE OR REPLACE conserve les droits.
--
-- Les droits sont reproduits tels quels et volontairement pas resserres. Ces
-- fonctions lisent `auth.uid()` : appelees par un visiteur anonyme, elles
-- renvoient NULL ou faux, sans rien divulguer. Y toucher en meme temps qu'on
-- les versionne melangerait deux changements, dont un capable de verrouiller
-- l'application entiere si un role venait a manquer.

CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = auth.uid();

  RETURN v_tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$function$;

-- Sert a l'amorcage de l'authentification : le profil doit pouvoir etre lu
-- AVANT que les politiques ne sachent a quel client l'utilisateur appartient.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(id uuid, tenant_id uuid, role text, email text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.tenant_id, p.role::text, p.email, p.full_name
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_tenant_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO anon, authenticated, service_role;
