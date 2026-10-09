-- cleanup_old_sync_runs (00086) existait depuis le 13/07, mais rien ne
-- l'appelait : 234 908 passages de synchro conserves le 09/10 (222 Mo), dont
-- la moitie de plus de trois mois. La date de derniere synchro du tableau de
-- bord en relisait 76 478 pour Florna.
--
-- Purge faite le 09/10 par tranches (environ 194 500 passages supprimes). La
-- fonction garde les 30 derniers jours et, par client et par source, le
-- dernier passage porteur d'un curseur (get_last_sync_cursor). Rien dans
-- l'application ne relit plus loin : reprise de la synchro sur le dernier
-- passage reussi, ecran d'historique sur les 10 derniers.
--
-- Planifiee chaque nuit (3 h 40 UTC), environ 1 400 passages par jour.

SELECT cron.schedule(
  'sync-runs-retention',
  '40 3 * * *',
  $$SELECT public.cleanup_old_sync_runs(30)$$
);
