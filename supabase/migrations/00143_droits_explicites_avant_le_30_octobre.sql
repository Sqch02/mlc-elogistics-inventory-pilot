-- Rendre les droits des tables explicites, et retirer l'acces anonyme.
--
-- Supabase annonce qu'a partir du 30/10/2026 il cessera d'accorder
-- automatiquement l'acces a la Data API aux NOUVELLES tables du schema
-- public, y compris dans une base reconstruite a partir des migrations
-- (projet neuf, branche de previsualisation, `supabase db reset`).
--
-- Nos migrations comptent sur cet octroi automatique : 30 tables creees, 16
-- migrations de creation sans aucun GRANT. En production rien ne change, les
-- tables gardent leurs droits. Mais une base reconstruite apres le 30/10
-- aurait des tables injoignables par l'application. Cette migration, jouee en
-- dernier lors d'une reconstruction, restaure les droits qui manqueraient.
--
-- CE QU'ON NE COPIE PAS DU MAIL DE SUPABASE
-- Leur exemple accorde la lecture a `anon`. L'application n'en a jamais
-- besoin, verifie le 23/09 : le navigateur ne fait que de l'authentification,
-- et les 13 routes API qui lisent avec la session verifient l'utilisateur
-- avant toute lecture. Chaque lecture de table passe par `authenticated` ou
-- par `service_role`, jamais par `anon`.
--
-- POURQUOI RETIRER `anon` MAINTENANT
-- 27 tables accordaient TOUS les droits a `anon`, par le reglage par defaut.
-- La securite par ligne empechait bien toute fuite : une requete anonyme sur
-- les tables sensibles renvoyait une liste vide. Mais sur `shipments`, elle ne
-- renvoyait pas vide : elle balayait la table pendant huit secondes avant
-- d'etre coupee. La cle anonyme est publique, par nature : n'importe qui
-- pouvait faire travailler la base huit secondes par requete. Sans droit,
-- la requete est refusee immediatement, sans rien lire.
--
-- CE QUI NE BOUGE PAS
-- `authenticated` et `service_role` gardent exactement leurs droits actuels.
-- Les tables volontairement reservees au serveur le restent (app_config,
-- exchange_rates_cache, notification_outbox, sendcloud_sync_checkpoints, les
-- sauvegardes, les deux vues de suivi). Les vues materialisees restent
-- fermees en lecture a `authenticated`, puisqu'elles n'ont pas de securite
-- par ligne.

-- 1. Plus aucun droit anonyme sur les tables, vues et vues materialisees.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- 2. Les tables creees plus tard par nos migrations ne l'accorderont pas non
--    plus. (Seul le role qui execute les migrations est concerne.)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

-- 3. Le role serveur a tout, partout. Sans effet en production, ou il l'a
--    deja ; indispensable dans une base reconstruite apres le 30/10.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 4. La session utilisateur, table par table, a l'identique de la production.
--    La securite par ligne reste ce qui decide de ce qu'elle voit.
DO $$
DECLARE
  t text;
  complet text[] := ARRAY[
    'bundle_components', 'bundles', 'claim_history', 'claims',
    'cron_tenant_locks', 'dismissed_anomalies', 'inbound_restock',
    'invoice_lines', 'invoices_monthly', 'location_assignments', 'locations',
    'pricing_rules', 'profiles', 'returns', 'sendcloud_sku_mappings',
    'shipment_items', 'shipments', 'sku_mappings', 'skus', 'stock_movements',
    'stock_snapshots', 'sync_runs', 'tenant_billing_config',
    'tenant_invitations', 'tenant_settings', 'tenants', 'unmapped_items'
  ];
  -- Consultables par l'interface, jamais modifiables par elle.
  lecture_seule text[] := ARRAY['auto_fix_jobs', 'auto_fixes'];
BEGIN
  FOREACH t IN ARRAY complet LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY lecture_seule LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;
