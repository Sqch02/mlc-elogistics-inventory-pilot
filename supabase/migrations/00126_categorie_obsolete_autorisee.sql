-- Autoriser la categorie `obsolete`, introduite par la migration 00120.
--
-- LA FAUTE, ET ELLE EST A MOI
-- La migration 00120 fait router le verdict `order_not_corrigible` vers un
-- etat terminal en posant `error_category = 'obsolete'`. La contrainte qui
-- enumere les categories autorisees n'a jamais ete mise a jour.
--
-- Consequence : chaque fois que le moteur constatait qu'une commande etait
-- deja partie, l'enregistrement du refus echouait. La tache restait en
-- 'claimed', son verrou expirait, elle etait reprise au passage suivant,
-- echouait pareil. Une boucle sans fin, et le compte rendu du travailleur
-- affichait tranquillement `skipped: 2, failed: 0`.
--
-- TROISIEME FOIS
-- C'est la troisieme contrainte de cette table sur laquelle je bute pour la
-- meme raison : le code produit une valeur, la base l'enumere ailleurs, et
-- personne ne verifie que les deux listes coincident. Les motifs ont ete
-- alignes ce matin (00123, sur DEUX contraintes, la seconde trouvee seulement
-- parce que la premiere avait refuse). Voici la troisieme : les categories.
--
-- Le test `error-categories.test.ts` verrouille desormais la correspondance a
-- la source, pour cette liste-ci comme pour les prochaines valeurs ajoutees.
--
-- COMMENT ELLE A ETE TROUVEE
-- Pas en relisant le code : je l'avais relu et je ne l'avais pas vue. En
-- rendant l'echec visible. `refuse()` appelait la base sans regarder le
-- resultat ; une fois ce retour verifie et remonte dans le compte rendu, le
-- message est apparu en une seule execution.

ALTER TABLE public.auto_fix_jobs
  DROP CONSTRAINT IF EXISTS auto_fix_jobs_error_category_check;

ALTER TABLE public.auto_fix_jobs
  ADD CONSTRAINT auto_fix_jobs_error_category_check CHECK (
    error_category IS NULL OR error_category = ANY (ARRAY[
      'retryable',
      'non_retryable',
      'configuration',
      'internal',
      'unknown',
      'mismatch',
      'verification_failed',
      'write_rejected',
      'write_uncertain',
      'resolved',
      -- Ajoutee par 00120 : la source n'est plus corrigeable, ce n'est donc
      -- pas un echec mais une tache sans objet.
      'obsolete'
    ]::text[])
  );
