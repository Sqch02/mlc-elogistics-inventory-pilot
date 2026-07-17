-- PERF (audit 17/07/2026): applique en prod via CREATE/DROP INDEX CONCURRENTLY
-- (hors transaction, zero lock). Cette migration documente ces changements pour
-- que le repo reflete la prod. Les CONCURRENTLY ne peuvent pas tourner dans une
-- transaction de migration; si rejoue localement, retirer CONCURRENTLY ou lancer
-- hors transaction.

-- 1. Watermark du cron: la requete `sync_runs WHERE tenant_id=? AND source=?
--    AND status='success' ORDER BY ended_at DESC LIMIT 1` representait ~22% du
--    temps DB total (564ms x 3579 appels). Il manquait l'index composite exact
--    (les index existants couvraient tenant, tenant+source, tenant+status
--    separement). Passe de 564ms a ~6ms (Index Only Scan).
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_runs_watermark
--   ON public.sync_runs (tenant_id, source, status, ended_at DESC);

-- 2. Recherche expeditions: ILIKE '%terme%' sur order_ref/tracking/sendcloud_id
--    (table 738MB) faisait un seq-scan (timeout 8s a froid). Index trigram GIN.
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_search_trgm
--   ON public.shipments USING gin (order_ref gin_trgm_ops, tracking gin_trgm_ops, sendcloud_id gin_trgm_ops);

-- 3. FK sans index couvrant (advisor perf).
-- CREATE INDEX IF NOT EXISTS idx_claim_history_changed_by ON public.claim_history (changed_by);
-- CREATE INDEX IF NOT EXISTS idx_tenant_invitations_invited_by ON public.tenant_invitations (invited_by);

-- 4. Index a 0 scan sur shipments (table la plus write-amplifiee): supprimes pour
--    accelerer les ecritures et liberer ~9MB.
-- DROP INDEX CONCURRENTLY IF EXISTS idx_shipments_recipient;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_shipments_country;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_shipments_has_error;

-- NB: les commandes reelles ont ete jouees via l'outil d'admin (CONCURRENTLY).
-- Ce fichier sert de trace; SELECT 1 pour etre un no-op idempotent au replay.
SELECT 1;
