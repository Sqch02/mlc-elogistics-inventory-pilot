# Passation Codex — travail restant après le méga-audit (13/07/2026)

> Colle ce fichier comme prompt à Codex, ou dis-lui : « Lis `docs/CODEX_HANDOFF.md` et traite les tâches restantes une par une, en respectant les contraintes. »

## Contexte projet

- **App** : Next.js 16 (App Router) + Supabase (Postgres + RLS). SaaS logistique 3PL **multi-tenant EN PRODUCTION** (Render), avec de vrais clients (Florna ~500 colis/jour, ANTEOS, REBORN21, Motijet). Intégration transporteur : **Sendcloud** (cron toutes les 5 min + webhook temps réel + sync manuel).
- **Migrations** : `supabase/migrations/` numérotées (dernière = `00088`). Appliquer les nouvelles via Supabase CLI/MCP **et** ajouter le fichier dans le repo.
- **Commandes** : `npm run build` (inclut le typecheck), `npm run lint`, `npx tsc --noEmit`, `npx vitest run`.
- **Déploiement** : merge sur `main` = déploiement auto Render. Le cron s'authentifie avec `Authorization: Bearer <CRON_SECRET>`.

## Protocole obligatoire à CHAQUE changement

1. **Ne casse jamais** le cron (`/api/sync/sendcloud/cron`), le webhook (`/api/webhooks/sendcloud/[tenantCode]`), ni le login.
2. Avant de commiter : `npx tsc --noEmit` = 0 erreur, `npx eslint <fichiers>` = 0 erreur.
3. Un item = une PR ciblée. Vérifie après déploiement que les `sync_runs` restent en `status='success'`.
4. Pour toute mutation de données/schéma en prod : **backup d'abord**, applique par lots si volumineux (les grosses requêtes timeout).

## Pièges CRITIQUES (déjà appris à la dure — ne pas répéter)

- **`REVOKE EXECUTE ... FROM anon, authenticated` est un NO-OP** si le droit vient de `PUBLIC`. Il faut TOUJOURS `REVOKE ... FROM PUBLIC` puis `GRANT` ciblé. Pour toute nouvelle RPC `SECURITY DEFINER` : `REVOKE EXECUTE FROM PUBLIC` + `GRANT TO service_role` (et `authenticated` seulement si le client l'appelle et qu'un garde-fou tenant protège).
- **Le garde-fou tenant `IF auth.uid() IS NOT NULL AND ...`** laisse passer `anon` (uid NULL). C'est voulu pour `service_role` mais anon a AUSSI uid NULL — donc il FAUT que anon n'ait pas le droit EXECUTE (cf ci-dessus).
- **`shipment_items.qty` = `qty`** (jamais `quantity`). `shipments.status_id` (jamais `status`). `sync_runs.ended_at` (jamais `finished_at`). `pricing_status` est un ENUM (`::pricing_status`).
- **NE JAMAIS réactiver les triggers `remap_on_mapping_insert` / `remap_on_sku_insert`** : ils sont désactivés VOLONTAIREMENT (un incident passé a re-décrémenté le stock en masse quand ils se sont déclenchés).
- **La zone webhook secret est fragile** : exiger un secret par tenant a DÉJÀ cassé tous les webhooks temps réel (aucun tenant n'avait le secret). Toute modif ici = tester en live avec le client d'abord.
- La consommation de stock passe désormais par les RPC `apply_stock_delta` + `consume_shipment_stock` (transactionnel) + un compare-and-swap sur `shipments.stock_consumed_at`. Ne pas revenir à un read-modify-write en JS.
- `src/lib/supabase/untyped.ts` (`getAdminDb` = service_role, `getServerDb` = authenticated) propage `any`. Utilise `getAdminDb` côté serveur/cron, `getServerDb` pour les requêtes RLS liées à l'utilisateur.

## DÉJÀ FAIT pendant l'audit (NE PAS refaire)

43 findings sur 56 corrigés (tous les P0 et P1). En résumé :
- Sécu : `REVOKE FROM PUBLIC` sur les RPC sensibles (anon renvoie 401) ; `fast-auth.ts` valide le JWT via `getUser()` ; `requireRole` ajouté sur import/pricing/invoices/claims ; headers HTTP (HSTS/X-Frame-Options/nosniff) ; garde serveur sur `/emplacements`.
- Stock : `apply_stock_delta`/`consume_shipment_stock` atomiques + CAS `stock_consumed_at` ; `unmapped_items` en REPLACE par expédition + contrainte `UNIQUE NULLS NOT DISTINCT` (00081) + dédup de 1,9M doublons ; ANTEOS dégonflé ; `CHECK qty <= 10000` (00080).
- Sync/facturation : verrou cron = bail auto-expirant en table (00083) ; facture `sent→paid` débloquée (00082) ; bracket tarifaire déterministe (`.order('weight_min_grams')` sur les 5 chemins) ; dashboard freshness réel ; health-check ping DB (sans 503) ; sync manuel convergé sur `processShipmentItems`.
- Fonctions de rétention créées (création seule, **à planifier côté ops**) : `cleanup_resolved_unmapped_items(days)`, `cleanup_old_sync_runs(days)`.

## TÂCHES RESTANTES (par ordre recommandé)

### 0. PRÉ-REQUIS — Réparer l'infra de test (test-only, ZÉRO risque prod)
~36 tests échouent (pré-existant, mocks obsolètes — aucun bug caché confirmé). C'est le filet de sécurité pour valider les refactors suivants. Fichiers : `dashboard/route.test.ts`, `locations/route.test.ts`, `products/route.test.ts`, `returns/route.test.ts`, `src/lib/utils/pricing-matcher.test.ts`.
Causes : (a) le mock `@/lib/supabase/fast-auth` n'exporte pas `getFastTenantId` (l'ajouter au `vi.mock`) ; (b) le mock `cookies()` n'a pas `getAll` (l'ajouter) ; (c) des query mocks manquent `.eq` ; (d) `pricing-matcher.test.ts` attend d'anciens libellés (`suisse`) alors que `getDestination` renvoie `domicile_suisse`/`relay_be`/… — mettre à jour les attentes, ET ce fichier teste `findPricingRule` qui est du **CODE MORT** (voir tâche 6). Objectif : `npx vitest run` tout vert.

### 1. Tests des chemins critiques (P2 #18, #19)
Une fois l'infra réparée, ajouter des tests unitaires (vitest) sur : le pipeline de sync (`runSync`), la résolution de bracket/destination (`pricing.ts` : `getDestination` + le matching), la décomposition bundle. Ce sont les chemins qui manipulent argent + stock et n'ont aucun test.

### 2. Statut d'auth cohérent (transverse — 401/403 au lieu de 500)
`requireTenant`/`requireRole`/`requireAuth` (`src/lib/supabase/auth.ts`) lèvent un `Error` simple → TOUTES les routes renvoient **500** sur échec d'auth au lieu de 401/403. Créer une classe d'erreur typée (ex `AuthError` avec `.status`) + un helper de catch partagé, et l'utiliser dans les routes API. Sécu inchangée (déjà rejeté), mais codes propres.

### 3. maxPages du cron (P2 #3)
`src/app/api/sync/sendcloud/cron/route.ts` : `fetchAllParcels(credentials, since, 2)` et `fetchAllIntegrationShipments(credentials, 2)` plafonnent à **2 pages (200 items)** par tick et avancent le curseur. En cas de pic, du backlog est définitivement sauté. Augmenter prudemment le plafond OU boucler jusqu'à rattrapage sans faire exploser le temps de sync (attention au timeout Render et au verrou cron 15 min). Tester le temps de sync après.

### 4. Perf N+1 dans le chemin chaud (P3 #16, #17, #18) — PRUDENCE
- #16 : `refresh_sku_metrics` est appelé par tenant DANS la boucle du cron **et** `refresh_all_analytics_views` à la fin → redondant. Retirer l'un des deux (garder le per-tenant qui existe car le global timeout parfois).
- #17 : `processShipmentItems` (`src/lib/utils/sku-mapping.ts`) appelle le RPC `map_shipment_item` 1× par article en série. Batcher.
- #18 : le dédup UUID/numeric du cron fait une boucle par-SKU avec SELECT+UPSERT+INSERT séquentiels pour reverser le stock. Batcher.
Chemin chaud = mesurer avant/après, déployer isolément, surveiller les `sync_runs`.

### 5. Refactors de dette (P2 #13, #14) — gros effort, zéro gain fonctionnel
- #13 : le bloc de construction du row `shipments` (~40 champs) + le matching pricing est **triplé** dans `cron/route.ts`, `run/route.ts`, `webhooks/.../route.ts`. Extraire un helper partagé `buildShipmentRow(parcel, pricingRules)`.
- #14 : `untyped.ts` propage `any` sur ~57 fichiers. Typer progressivement (générer les types Supabase et remplacer `getAdminDb`/`getServerDb` par des clients typés), fichier par fichier.

### 6. Nettoyages sûrs (petits)
- **Code mort pricing** : `findPricingRule`, `updateShipmentPricing`, `recalculateAllPricing` dans `src/lib/utils/pricing.ts` n'ont AUCUN appelant (vérifié) → supprimables. Garde `getDestination` et `getShippingPrice` (utilisés).
- **Logs sync (P3 #24)** : ajouter un id de corrélation par run dans les logs cron/reconcile (observabilité).
- **Cache profil (P2 #2)** : `_profile_cache` a un TTL 5 min (révocation de rôle différée). Déjà atténué (`getFastUser` valide via `getUser`). Refonte middleware si on veut du temps réel — invasif, faible priorité.

### 7. Secret webhook par tenant (P3 #19) — HAUT RISQUE, à faire AVEC le client
`src/app/api/webhooks/sendcloud/[tenantCode]/route.ts` valide la signature avec un secret global unique (fallback `SENDCLOUD_WEBHOOK_SECRET`) partagé par tous les tenants → un payload signé est accepté pour n'importe quel `tenantCode`. Le bon fix = un `sendcloud_webhook_secret` par tenant + lier la signature au `tenantCode`. **MAIS** : exiger un secret par tenant a déjà cassé tous les webhooks. Déployer avec un fallback, migrer tenant par tenant en testant chaque webhook en live.

### Hors-code (à remonter à l'équipe, pas pour Codex)
Pas de rate-limiting (login/webhook/cron exposés) ; du SQL de prod avec données clients versionné dans `scripts/*.sql` (RGPD) ; pas de backups automatisés/testés ni de rotation des secrets (le Bearer cron est un token statique long-vécu).

---
Rapport d'audit complet (statut par finding) : voir l'artifact partagé par l'équipe. Commence par la tâche 0, valide chaque item (`tsc`+`lint`+`vitest`+`sync_runs success`) avant le suivant.
