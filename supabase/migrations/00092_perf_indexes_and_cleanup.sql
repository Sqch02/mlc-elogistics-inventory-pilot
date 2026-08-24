-- Index de performance de l'audit du 17/07/2026.
--
-- POURQUOI CE FICHIER A ETE REECRIT LE 24/08
-- Il ne contenait que des commentaires et un `SELECT 1;`. Les commandes
-- avaient ete jouees a la main en production avec CONCURRENTLY, et le fichier
-- servait seulement a en garder trace. Une base reconstruite depuis ce depot
-- n'aurait donc eu AUCUN de ces index -- dont celui qui fait passer la lecture
-- du repere de synchronisation de 564 ms a 6 ms, soit un cinquieme du temps
-- total passe en base.
--
-- Une migration qui documente sans appliquer donne la pire des impressions :
-- on lit le depot, on croit l'index present, et il ne l'est pas.
--
-- CONCURRENTLY a ete retire : cette clause est interdite dans une transaction,
-- et c'est precisement pour cela que les commandes avaient ete sorties d'ici.
-- Tout est idempotent, donc sans effet sur la production ou les index existent
-- deja, et sans verrou notable sur une base neuve.
--
-- Etat verifie en production le 24/08 : les quatre index existent, les trois
-- suppressions ont bien eu lieu.

-- L'index trigram exige pg_trgm. L'extension est deja creee par la migration
-- 00077, mais on ne s'appuie pas sur l'ordre pour une dependance aussi lourde.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Repere du cron. La requete `sync_runs WHERE tenant_id=? AND source=?
--    AND status='success' ORDER BY ended_at DESC LIMIT 1` representait ~22 %
--    du temps total passe en base (564 ms x 3579 appels). Il manquait l'index
--    composite exact : les index existants couvraient tenant, tenant+source et
--    tenant+status separement. 564 ms -> ~6 ms, en Index Only Scan.
CREATE INDEX IF NOT EXISTS idx_sync_runs_watermark
  ON public.sync_runs (tenant_id, source, status, ended_at DESC);

-- 2. Recherche d'expeditions. Un ILIKE '%terme%' sur order_ref, tracking et
--    sendcloud_id parcourait une table de 738 Mo en entier, avec un delai
--    depasse a 8 s a froid.
CREATE INDEX IF NOT EXISTS idx_shipments_search_trgm
  ON public.shipments USING gin (order_ref gin_trgm_ops, tracking gin_trgm_ops, sendcloud_id gin_trgm_ops);

-- 3. Cles etrangeres sans index couvrant.
CREATE INDEX IF NOT EXISTS idx_claim_history_changed_by
  ON public.claim_history (changed_by);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_invited_by
  ON public.tenant_invitations (invited_by);

-- 4. Index jamais parcourus sur la table la plus sollicitee en ecriture :
--    supprimes pour alleger les ecritures et liberer ~9 Mo.
DROP INDEX IF EXISTS public.idx_shipments_recipient;
DROP INDEX IF EXISTS public.idx_shipments_country;
DROP INDEX IF EXISTS public.idx_shipments_has_error;
