-- La date de derniere synchro (en-tete du tableau de bord, vue hub, controle
-- de sante) cherche le dernier passage d'un client, tous statuts confondus.
-- L'index de reprise (tenant_id, source, status, ended_at) ne sert qu'un
-- statut a la fois : avec trois statuts, Postgres relisait les 76 478
-- passages de Florna pour n'en garder qu'un. Mesure le 09/10 : 2,4 s donnees
-- en memoire, 5,5 s sinon, et 5 appels coupes a 8 s dans la journee. Coupe,
-- l'appel faisait afficher une synchro en echec alors qu'elle tournait.
--
-- Avec ended_at juste apres la source, le dernier passage se lit directement.

CREATE INDEX IF NOT EXISTS idx_sync_runs_dernier_passage
  ON public.sync_runs (tenant_id, source, ended_at DESC);
