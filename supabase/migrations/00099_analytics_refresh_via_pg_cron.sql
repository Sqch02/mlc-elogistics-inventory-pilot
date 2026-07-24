-- Rafraichissement des vues analytiques : deplace du cron applicatif vers pg_cron.
--
-- LE PROBLEME MESURE (24/07/2026)
-- Le role `authenticator` porte statement_timeout=8s (et lock_timeout=8s), et
-- `service_role` n'a aucune config propre : il en herite. Tout appel passant par
-- PostgREST est donc plafonne a 8 secondes.
-- Or refresh_all_analytics_views() coute ~44 s, dont ~35 s pour la seule
-- v_physical_shipment_items. Le refresh de cette vue ne pouvait donc JAMAIS
-- aboutir depuis le cron applicatif.
-- Constat en base : ~3 174 tentatives, 0 succes pour refresh_physical_items_view ;
-- refresh_dashboard_daily reussissait de justesse (moyenne 6 869 ms, maximum
-- 7 995 ms, soit 5 ms sous le plafond). La vue physique accusait 2 h 40 de
-- retard et n'etait a jour que parce qu'un humain l'avait rafraichie a la main.
-- Comme mv_sku_metrics est construite SUR v_physical_shipment_items, son refresh
-- "reussi" toutes les 5 minutes re-derivait d'une source figee.
--
-- CE QUI NE MARCHE PAS, ET QUI A ETE TESTE
-- Poser un statement_timeout au niveau de la fonction (ALTER FUNCTION ... SET
-- statement_timeout) ne corrige rien : PostgreSQL arme le minuteur au demarrage
-- de la requete et ne le re-arme pas si le GUC change en cours d'execution.
-- Verifie empiriquement : une fonction portant SET statement_timeout='30s',
-- appelee dans une session a 2 s, est tuee au bout de 2 s.
--
-- LA CORRECTION
-- pg_cron s'execute dans un worker de fond, en tant que postgres, en dehors de
-- PostgREST : il n'herite pas du plafond de 8 s.
-- Minutes 7 et 37 : le job demarre entre deux ticks du cron 5 minutes et se
-- termine (~44 s) avant le suivant, ce qui evite toute contention de verrou sur
-- mv_sku_metrics, que le cron applicatif continue de rafraichir chaque tick.
--
-- BUDGET I/O (le point sensible, cf incident du 13/07)
-- Avant : 8 s gaspillees + 6,9 s + 2,3 s a chaque tick de 5 min = ~3,44 s/min.
-- Apres : 44 s toutes les 30 min + 2,3 s par tick        = ~1,92 s/min.
-- Soit environ 44 % d'I/O analytique en MOINS, et des vues enfin fraiches.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- cron.schedule met a jour le job s'il porte deja ce nom : rejouable.
SELECT cron.schedule(
  'refresh-analytics-views',
  '7,37 * * * *',
  'SELECT public.refresh_all_analytics_views();'
);

-- Verification apres application :
--   SELECT jobid, jobname, schedule, active FROM cron.job;
--   SELECT status, return_message, start_time, end_time
--     FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- Fraicheur attendue (moins de ~30 min de retard) :
--   SELECT (SELECT max(shipped_at) FROM shipments WHERE is_return = false)
--        - (SELECT max(shipped_at) FROM v_physical_shipment_items) AS retard;
