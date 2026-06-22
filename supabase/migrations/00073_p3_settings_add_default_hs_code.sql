-- Ajoute le code douanier (SH/HS) par defaut + le pays d'origine par defaut
-- au niveau de chaque client, editables depuis l'ecran admin de configuration
-- du client (/admin/tenants/[id]).
--
-- Aurelien remplit ces champs une fois quand il parametre un client ; ils
-- servent (1) de reference pour ne plus avoir a chercher le code a chaque
-- commande, et (2) de valeur par defaut pour la phase 2 (auto-fix Sendcloud,
-- pattern "code douanier manquant" sur les envois hors UE).
--
-- Note phase 2 : le module auto-fix lira tenant_settings.default_hs_code /
-- default_origin_country au lieu de creer une table tenant_customs_settings
-- separee (consolidation).

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS default_hs_code text,
  ADD COLUMN IF NOT EXISTS default_origin_country text DEFAULT 'FR';
