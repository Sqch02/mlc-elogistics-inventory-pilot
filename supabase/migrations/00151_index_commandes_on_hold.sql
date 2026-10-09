-- reconcile_stuck_candidates (appelee par la synchro, toutes les 5 minutes,
-- pour chaque client) cherche les commandes « On Hold » sans colis suivi. Pour
-- Florna, presque toute la table, Postgres relisait les 178 Mo de colis a
-- chaque appel : coupe a 8 s, 12 fois par heure, sans jamais aboutir depuis au
-- moins le 07/10 (journaux postgres du 09/10).
--
-- Un index partiel ne garde que les commandes On Hold (environ 5 400 lignes,
-- 120 ko) : 0,3 s au lieu de plus de 8 s. Simulation faite avant de le poser,
-- le 09/10 : les 40 commandes candidates n'ont aucun colis chez Sendcloud, la
-- reconciliation ne fait que les marquer verifiees. Aucun statut, aucun stock,
-- aucun chiffre ne change.
--
-- Cree en prod avec CONCURRENTLY (sans bloquer la synchro) ; ici sans, pour
-- qu'une base reconstruite l'ait aussi.

CREATE INDEX IF NOT EXISTS idx_shipments_commandes_on_hold
  ON public.shipments (tenant_id, created_at DESC)
  WHERE status_message = 'On Hold'
    AND is_return = false
    AND order_ref IS NOT NULL
    AND sendcloud_id LIKE '%-%';
