-- Conserver le numero de commande sur la tache.
--
-- CONSTAT (mesure production 07/08/2026)
-- 103 taches ont du etre refermees sans avoir jamais pu etre traitees, avec le
-- refus `order_ref_unknown` (verifie en production sur un echantillon remis en
-- file). La tache ne stockait que l'EMPREINTE du numero de commande ; le
-- numero lui-meme etait relu au moment du traitement depuis la table des
-- expeditions. Quand cette ligne disparait, la tache devient orpheline :
--   - le moteur ne peut plus retrouver la commande a corriger,
--   - l'exploitation ne peut meme pas savoir de quelle commande il s'agit,
--     un UUID technique ne se reconnaissant pas.
--
-- La tache CONNAIT pourtant ce numero a sa creation. On cesse simplement de le
-- jeter. La table d'audit `auto_fixes` fait deja ce choix depuis la migration
-- 00110, et pour exactement la meme raison.
--
-- L'empreinte est conservee : elle sert au rapprochement et a la deduplication.

ALTER TABLE public.auto_fix_jobs
  ADD COLUMN IF NOT EXISTS source_order_ref text;

COMMENT ON COLUMN public.auto_fix_jobs.source_order_ref IS
  'Numero de commande lisible, fige a la creation. Sans lui, une tache dont la ligne d expedition a disparu n est plus identifiable par personne.';

-- Rattrapage pour les taches encore ouvertes dont l expedition existe toujours.
-- Celles dont la ligne a deja disparu sont irrecuperables : le numero n a
-- jamais ete conserve nulle part. C est precisement ce que cette migration
-- empeche de reproduire.
UPDATE public.auto_fix_jobs j
SET source_order_ref = s.order_ref
FROM public.shipments s
WHERE s.sendcloud_id = j.original_sendcloud_id
  AND s.tenant_id = j.tenant_id
  AND j.source_order_ref IS NULL
  AND s.order_ref IS NOT NULL;
