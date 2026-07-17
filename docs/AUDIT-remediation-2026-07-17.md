# Remédiation méga-audit — nuit du 17/07/2026 (autonome)

Travail réalisé en autonomie sur la base du méga-audit (53 findings). Règle appliquée :
**déployer tout ce qui corrige/améliore sans altérer le fonctionnement ; préparer /
documenter (sans déployer) les changements de comportement métier à fort rayon.**

Prod vérifiée saine après chaque déploiement (app `db:ok`, cron success, 303 tests verts).

## ✅ Déployé en production

### Sécurité
- **P0 escalade de privilège fermé** (migration 00091) — trigger `BEFORE INSERT/UPDATE`
  sur `profiles` bloquant tout changement de `role`/`tenant_id` (ou insert avec rôle
  privilégié) par un appelant `authenticated`/`anon` non super_admin. Le service_role
  (admin) et postgres passent. Vérifié : aucun code applicatif ne modifie `profiles.role`
  via session user → ne casse rien. **Trou confirmé exploitable en prod avant fix.**
- **Secret cron en temps constant** (`safe-compare.ts`) sur `/cron` et `/reconcile`
  (évite le timing-attack sur le bearer).
- **Anti open-redirect** au login (`redirectTo` restreint aux chemins internes).
- **Scope tenant** ajouté aux DELETE liés de `skus/[id]` (défense cross-tenant).
- **Gardes de rôle** sur `skus/[id]/stock` PATCH et `invoices/[id]/lines` POST+DELETE
  (les routes API sont hors middleware → un compte 'client' pouvait muter stock/factures).

### Performance (le « chargement long »)
Cause chiffrée via `pg_stat_statements` : la requête watermark du cron représentait
**~22% du temps DB total** (564 ms × 3579 appels) faute d'index composite.
- **Index `idx_sync_runs_watermark`** (tenant_id, source, status, ended_at DESC) →
  **564 ms → 6 ms (~90×)**, Index Only Scan. Plus gros gain de charge DB.
- **Index trigram** `idx_shipments_search_trgm` (order_ref/tracking/sendcloud_id) →
  la recherche expéditions (ILIKE `%…%` sur 738 MB) passait par un seq-scan (timeout
  8 s à froid). Maintenant indexée.
- **Index FK couvrants** (claim_history.changed_by, tenant_invitations.invited_by).
- **Drop de 3 index shipments à 0 scan** (recipient, country, has_error) → moins de
  write-amplification sur la table la plus sollicitée. Trace : migration 00092.

### Observabilité
- **Sentry activé** — `src/instrumentation.ts` + `instrumentation-client.ts` manquaient,
  donc les `sentry.*.config.ts` n'étaient JAMAIS chargés (aucune erreur remontée).
  No-op tant que le DSN n'est pas défini. **→ Définir `NEXT_PUBLIC_SENTRY_DSN` sur Render
  pour activer réellement la remontée.**
- **`/api/health/sync`** — endpoint additif exposant la fraîcheur de sync + flag
  `degraded` (à brancher sur un moniteur externe type UptimeRobot).

### Correctness
- **Perte de lignes unmapped corrigée** (`sku-mapping.ts`) — agrégation par clé avant
  insert (évitait une violation NULLS NOT DISTINCT qui, après le DELETE commité,
  perdait toutes les lignes du colis).

### Docs / config
- `.env.example` : `SENDCLOUD_CRON_MAX_PAGES` 10→2 + avertissement incident 13/07,
  section OPERATIONS. `CLAUDE.md` (local) : domaine webhook live + range migrations.

## ⏳ Actions manuelles pour toi (dashboards, hors de ma portée)
- **Définir `NEXT_PUBLIC_SENTRY_DSN`** sur Render (sinon Sentry reste no-op).
- **Rotation `CRON_SECRET`** : la valeur `mlc-cron-2024` est devinable. Générer
  `openssl rand -hex 32`, mettre à jour Render **et** cron-job.org.
- **Brancher un moniteur** sur `/api/health/sync` (matching `"degraded":false`).
- **Vérifier backups/PITR** dans le dashboard Supabase (posture non vérifiable par outil).

## 🛑 NON déployé — nécessite ta relecture / la signature d'Aurelien
Ces changements **altèrent le comportement métier** (stock/argent) ou ont un fort rayon.
Les déployer seul cette nuit aurait été le risque d'un nouvel incident.

1. **Fix permanent conso stock (REBORN21 P0)** — consommer à l'expédition, pas au stade
   « No label ». Spec : `docs/FIX-conso-stock-a-expedition.md`. Change le timing pour
   tous les tenants → signature Aurelien. **REBORN21 a re-dérivé (R21A = 0)** : voir plus bas.
2. **Fix ledger** (`adjustment` = delta appliqué, pas demandé) — DOIT précéder toute
   réversion de masse des ~5 900 paires historiques (sinon re-corruption).
3. **Router tous les chemins d'écriture stock** (recalculate, shipments/create, returns
   restock, inbound) via le RPC canonique `consume_shipment_stock`/`apply_stock_delta`.
4. **Watermark cron** : statut `partial` + timestamp de début de fetch (perte silencieuse
   sur cap/erreur upsert).
5. **Facturation** : régénération draft recalcule les totaux sans les lignes avoir/charge
   (sous-facturation) ; cleanup d'erreur supprime le draft pré-existant. Code argent → prudence.
6. **Découpler les 3 refresh de vues analytiques** du cron 5 min (charge I/O).

## ⚠️ REBORN21 — re-dérive à surveiller
R21A (activateur) est **repassé à 0** le 15/07 23:11. 4 commandes packs depuis le recalage
(867/866/868/869) ont re-sur-consommé (bug bundle × quantité toujours actif).
**Je n'ai PAS re-calibré** : la vraie valeur est incertaine (économie R21A3 incohérente,
pas de comptage physique frais). Un chiffre deviné altérerait la donnée à tort.
→ **Faire recompter Quentin puis recaler**, et prioriser le fix permanent (#1 ci-dessus).
Détecteur SQL dans `docs/FIX-conso-stock-a-expedition.md`.

## Différés mineurs (sûrs, non bloquants)
- Rétention `sync_runs` (100k lignes >30j) : différée pour éviter un spike I/O ; l'index a
  déjà réglé la vitesse. À câbler dans le cron avec garde quotidienne + batches.
- Timeout `AbortSignal` sur les 11 fetch Sendcloud (#21) : pas de helper central, 11
  éditions risquées pour un gain modéré.
- Bloat `unmapped_items` (819 MB) : VACUUM FULL nécessite une fenêtre de maintenance.
- Divers frontend (indicateur sync, états d'erreur, def « stock critique » unifiée).
