-- Aligner la contrainte des motifs sur ceux que le code produit.
--
-- CE QUI ALLAIT SE PASSER
-- `auto_fix_jobs_patterns_known` enumere les motifs autorises. Elle ne
-- connaissait ni `address_missing` — livre en production hier par la PR #129 —
-- ni `currency_unsupported`, ajoute ce matin.
--
-- L'insertion des taches se fait PAR LOTS de 250 dans `enqueue_auto_fix_jobs`.
-- Une seule tache portant un motif inconnu fait donc echouer la transaction
-- entiere : ce n'est pas une tache perdue, c'est tout le lot. La panne serait
-- survenue au premier colis sans rue, sans qu'on ait rien change ce jour-la.
--
-- Trouve le 24/08 en tentant de reclasser trois taches a la main : c'est la
-- contrainte qui a refuse la mise a jour. Elle a fait son travail.
--
-- DEUX CONTRAINTES, PAS UNE
-- La table en porte deux qui enumerent la liste : `patterns_known` sur le
-- tableau `detected_patterns`, et `primary_pattern_check` sur la colonne
-- `primary_pattern`. N'en corriger qu'une laisse la panne entiere : c'est
-- arrive ce matin meme, la seconde a refuse ce que la premiere venait
-- d'accepter. Le test parcourt donc TOUTE contrainte qui enumere des motifs,
-- sans se fier a un nom precis.
--
-- MEME FAMILLE QUE LES ETATS
-- Le meme decalage existait pour les etats des taches : la base en autorisait
-- quatorze, le code n'en connaissait que dix, et une tache bloquee en cours
-- d'ecriture etait invisible. Un test verrouille cet alignement-la depuis
-- (`job-states.test.ts`). Il en existe desormais un pour les motifs.

ALTER TABLE public.auto_fix_jobs
  DROP CONSTRAINT IF EXISTS auto_fix_jobs_patterns_known;

ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_patterns_known CHECK (
    detected_patterns <@ ARRAY[
      'currency_chf',
      'currency_unsupported',
      'address_too_long',
      'hs_code_missing',
      'weight_too_low',
      'service_point_missing',
      'sender_eori_missing',
      'address_missing',
      'unknown'
    ]::text[]
  );

ALTER TABLE public.auto_fix_jobs
  DROP CONSTRAINT IF EXISTS auto_fix_jobs_primary_pattern_check;

ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_primary_pattern_check CHECK (
    primary_pattern = ANY (ARRAY[
      'currency_chf',
      'currency_unsupported',
      'address_too_long',
      'hs_code_missing',
      'weight_too_low',
      'service_point_missing',
      'sender_eori_missing',
      'address_missing',
      'unknown'
    ]::text[])
  );
