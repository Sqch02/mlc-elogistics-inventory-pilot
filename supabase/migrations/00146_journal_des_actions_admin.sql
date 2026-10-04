-- Journal des actions d'administration.
--
-- 00018 creait cette table mais n'a jamais ete appliquee en production :
-- logAudit() ecrivait dans une table absente et avalait l'erreur. Aucune
-- activation, desactivation ou emission de lien de reinitialisation n'a
-- jamais ete tracee. Constate le 04/10.
--
-- Ecarts volontaires avec 00018 :
--   - ip_address en text : les routes passent l'en-tete x-forwarded-for
--     entier, qui depasse les 45 caracteres prevus des qu'un proxy s'ajoute.
--     L'insertion aurait echoue, en silence, a chaque fois.
--   - Aucune lecture pour les comptes connectes : rien dans l'application
--     ne lit ce journal, et il contient des adresses IP. 00018 l'ouvrait a
--     tous les utilisateurs du client, y compris le role client.
--   - Immuable y compris pour le role serveur : ni modification ni
--     suppression (la suppression d'un client reste possible, la cascade
--     s'execute avec les droits du proprietaire de la table).

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action varchar(50) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs (user_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM service_role;

COMMENT ON TABLE public.audit_logs IS
  'Journal immuable des actions d''administration. Ecrit par src/lib/audit.ts (role serveur).';
