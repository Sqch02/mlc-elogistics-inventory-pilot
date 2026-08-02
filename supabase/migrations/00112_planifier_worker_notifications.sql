-- Planification du worker de notifications.
--
-- OUBLI CONSTATE EN PRODUCTION. La fonction de declenchement existait, mais
-- elle n'a jamais ete planifiee : les deux seuls emails partis l'ont ete par
-- un appel manuel. Trois notifications attendaient depuis quatre jours sans
-- que rien ne les envoie, et rien ne le signalait — une file qui se remplit
-- sans se vider ne produit aucune erreur, juste un silence.
--
-- Toutes les dix minutes. Plus frequent que les autres workers, parce qu'une
-- alerte de stock perd sa valeur en vieillissant : la purge des notifications
-- perimees l'annule au bout de deux jours, autant l'envoyer bien avant.
--
-- Decale des minutes rondes et des autres travaux (3,18,33,48 et 8,23,38,53)
-- pour ne pas empiler les appels sur la meme application.

SELECT cron.schedule(
  'notifications-worker',
  '1,11,21,31,41,51 * * * *',
  $$SELECT public.trigger_notifications_worker();$$
);
