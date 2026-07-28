-- Planification du moteur d'ECRITURE.
--
-- Jusqu'ici volontairement manuel : les premieres executions devaient etre
-- surveillees. Elles l'ont ete. La premiere ecriture reelle est passee et a
-- ete verifiee par relecture (commande #541493, "1172 Route De-la
-- Croix-du-fraysse" -> "1172 Rte De-la Croix-du-fraysse"), et un lot de cinq a
-- montre que les refus fonctionnent : quatre renvois en revue humaine pour
-- perte d'information, un arret net sur une commande deja corrigee a la main.
--
-- Decale de 5 minutes par rapport au worker de simulation (3,18,33,48) : les
-- deux appellent la meme application, rien ne gagne a ce qu'ils se
-- superposent.
--
-- LE VOLUME RESTE BORNE PAR LE CLIENT, pas par cette planification :
-- tenant_settings.auto_fix_max_candidates plafonne chaque passage. Ralentir se
-- fait donc la, sans toucher au planning. Arret immediat : AUTO_FIX_PAUSED=true
-- sur Render, qui coupe le worker avant toute reclamation.

SELECT cron.schedule(
  'auto-fix-live-worker',
  '8,23,38,53 * * * *',
  $$SELECT public.trigger_auto_fix_live_worker();$$
);
