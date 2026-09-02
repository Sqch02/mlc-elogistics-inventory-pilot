-- Index partiel pour la recherche des colis figes a « Ready to send ».
--
-- MESURE DU 02/09
-- Sans lui, la requete des candidats parcourt l'index (tenant, shipped_at) a
-- l'envers et FILTRE 29 238 colis recents avant d'en trouver 50 anciens au bon
-- statut : 2,8 s a cache chaud pour 50 lignes. Avec la limite de 200 et un
-- cache froid, le delai de 8 s impose par PostgREST est a portee — et la
-- lecture des candidats echouait alors en silence, affichant « zero candidat »
-- pour Florna alors que 200 colis attendaient.
--
-- C'est la lecon deja notee : un predicat filtrant selectif se materialise
-- dans un index PARTIEL, pour que le parcours ne touche que les lignes utiles.
-- Les colis a 1000 sont quelques milliers ; les autres, des centaines de
-- milliers.

CREATE INDEX IF NOT EXISTS idx_shipments_ready_to_send_stale
  ON public.shipments (tenant_id, shipped_at DESC)
  WHERE status_id = 1000 AND is_return = false;
