# Auto-fix Sendcloud errors — Design doc

**Date** : 2026-05-21
**Auteur** : Maxime
**Statut** : Spec validee, en attente du plan d'implementation
**Stakeholders** : Aurelien (MLC PROJECT), Quentin (ops), equipe entrepot

## 1. Contexte et probleme

Aujourd'hui, une part significative des expeditions Sendcloud sont bloquees par des erreurs qui demandent une intervention manuelle. Apres scan de la base actuelle (21/05/2026) :

| Famille | Volume | Statut Sendcloud | Cause |
|---------|--------|------------------|-------|
| Contract not valid CHF | 33 | On Hold | Commande Suisse en CHF, contrat refuse la devise |
| Adresse trop longue | 29+ | On Hold | address_1, city, ou house_number depasse la limite |
| Code douanier manquant | 10+ | On Hold | hs_code et origin_country requis (Suisse, UK) |
| Poids trop bas | 5+ | On Hold | weight < 1g sur des parcel_items |
| Announcement failed generique | 600+ | 1002 | Echec d'annonce post-creation, error_message souvent vide |

Aujourd'hui Aurelien ou Quentin corrigent ces erreurs manuellement, une par une, directement dans Sendcloud. C'est chronophage et ca multiplie les risques d'oubli quand le volume augmente.

**Objectif** : que ces erreurs soient corrigees automatiquement sans intervention humaine, sauf pour les cas vraiment irrecuperables.

## 2. Goals / Non-goals

### Goals

- Detecter et reparer automatiquement les 5 familles d'erreurs identifiees
- Couvrir aussi bien les cas "On Hold" (modifiables) que "Announcement failed 1002" (necessitant cancel + recreate)
- Tracer chaque correction pour audit (avant/apres)
- Alerter l'equipe seulement quand l'auto-fix ne peut pas resoudre (seuil + cooldown)
- Permettre une intervention manuelle simple depuis l'app pour les cas residuels
- Multi-tenant : chaque client a sa propre config Sendcloud et ses propres codes douaniers

### Non-goals

- Modifier les commandes en amont (cote Shopify) — on intervient apres
- Garantir un succes 100% pour les "Announcement failed" (cancel peut etre refuse par le carrier)
- Detecter automatiquement de nouvelles familles d'erreurs (on logge les inconnues mais on ne tente pas de fix)
- Notification temps reel sub-minute (la cadence cron de 5 min est acceptable)

## 3. Architecture globale

```
cron-job.org (5 min)
   |
   v
POST /api/sync/sendcloud/cron  (existant, intact)
   -> sync Sendcloud normal
   -> en fin de run, chaine en interne /api/auto-fix/run
   
POST /api/auto-fix/run  (nouveau)
   1. Scan shipments candidats : 
        ((status_message = 'On Hold' AND error_message IS NOT NULL) OR status_id = 1002)
        AND auto_fix_attempts < 3
        AND (auto_fix_last_attempt IS NULL OR auto_fix_last_attempt < now() - INTERVAL '1 hour')
        AND status NOT IN ('pending_manual', 'manual_resolved')  -- pas de retry auto sur ceux-la
   2. Filtre anti-pingpong applique au scan (pas de retry plus rapide qu'1h sur le meme shipment)
   3. Pour chaque candidat :
      a. detect.ts : identifie le pattern via regex
      b. fixes/*.ts : applique la transformation
      c. apply.ts : PUT update OU cancel + recreate via Sendcloud API
      d. Log dans auto_fixes table (success ou failed)
      e. Update shipments.auto_fix_attempts + last_attempt
   4. Si compteur pending_manual >= 5 et pas d'alerte dans les 6h dernieres :
      -> envoyer alerte (email ou Slack selon tenant_settings)
   
Webhook Sendcloud  (existant, intact)
   -> continue a mettre a jour shipments normalement
   -> les corrections sont rattrapees au prochain tour cron
```

**Architecture isolee** : un module `src/lib/auto-fix/`, un endpoint, une table. Toggle global via env var `AUTO_FIX_ENABLED` + toggle par tenant via UI super-admin.

## 4. Fichiers et composants

### Nouveaux fichiers

```
src/lib/auto-fix/
   index.ts                Entry point: runAutoFix(tenantId?: string)
   detect.ts               Pattern matching: detectFixablePattern(shipment) -> FixPlan | null
   apply.ts                PUT update OU cancel+recreate via Sendcloud client
   exchange-rate.ts        BCE fetcher + 24h cache (read/write exchange_rates_cache)
   escalation.ts           Threshold checker + dispatcher (email/Slack)
   types.ts                FixPlan, FixResult, FixPattern enum, AutoFixContext
   fixes/
      currency.ts          CHF->EUR conversion
      address.ts           Abbrev + truncate + spillover
      customs.ts           HS code + origin_country resolution
      weight.ts            Min weight 1g
      index.ts             Fix registry + dispatcher par pattern

src/app/api/auto-fix/
   run/route.ts            POST /api/auto-fix/run (cron trigger)
   retry/[id]/route.ts     POST manual retry depuis UI
   status/route.ts         GET dashboard stats (KPI + pending + history paginated)

src/app/(dashboard)/corrections-auto/
   page.tsx                Wrapper RSC
   CorrectionsAutoClient.tsx
   loading.tsx

src/components/auto-fix/
   AutoFixStatsCards.tsx
   PendingManualTable.tsx
   AutoFixHistoryTable.tsx
   AutoFixDetailDialog.tsx   Diff before/after viewer

supabase/migrations/
   00052_auto_fixes_table.sql           Table auto_fixes + indexes + RLS
   00053_exchange_rates_cache.sql       Cache taux de change BCE
   00054_tenant_customs_settings.sql    HS code default par tenant + seed initial
   00055_shipments_auto_fix_columns.sql Colonnes auto_fix_attempts + last_attempt sur shipments
   00056_auto_fix_state.sql             Table mono-ligne pour cooldown alertes
```

### Fichiers modifies

```
src/app/api/sync/sendcloud/cron/route.ts   Chainage de runAutoFix en fin de runSync
src/lib/sendcloud/client.ts                Ajout fonction cancelParcel (si pas deja la)
src/components/layout/Sidebar.tsx          Nouveau lien "Corrections auto"
```

## 5. Patterns d'erreur detectes et fixes

### Pattern 1 — CHF Contract not valid

- **Detection** : `error_message ~ /Contract is not valid/i` ET `country_code = 'CH'`
- **Diagnostic** : commande Suisse arrive en CHF, le contrat Sendcloud rejette
- **Fix** :
   1. Recuperer le taux EUR/CHF via `exchange-rate.ts` (cache 24h, fallback BCE API gratuite)
   2. Convertir `total_value` et chaque `parcel_items[].value`
   3. PUT update Sendcloud avec `currency='EUR'` et nouvelles valeurs
- **Action API** : PUT /parcels/{id}
- **Statut applicable** : On Hold (status_id null)

### Pattern 2 — Adresse trop longue

- **Detection** : `error_message ~ /(address_1|city|house_number).+has at most (\d+) characters/i`
- **Diagnostic** : champ adresse depasse la limite Sendcloud du carrier
- **Fix** :
   1. Parser la limite N depuis le message d'erreur
   2. Appliquer table d'abreviations FR :
      - Boulevard -> Bd, Avenue -> Av, Rue -> R, Place -> Pl
      - Batiment -> Bat, Apartment -> Apt, Residence -> Res, Etage -> Et
      - Numero -> N, Appartement -> Apt, Cour -> C
   3. Si encore trop long et le champ est `address_1` : tenter de deplacer `house_number` vers `address_2` quand celle-ci est vide
   4. Dernier recours : troncature au caractere word-boundary < N
- **Action API** : PUT /parcels/{id}
- **Statut applicable** : On Hold

### Pattern 3 — Code douanier manquant

- **Detection** : `error_message ~ /hs_code.+required/i` OU `origin_country.+required/i`
- **Diagnostic** : commande hors UE (Suisse, UK, etc.), Sendcloud exige declaration douaniere
- **Fix** :
   1. Pour chaque parcel_item, essayer de lire le HS code depuis Shopify via le `variant_id` present dans `raw_json.parcel_items[i].variant_id`. Necessite des credentials Shopify par tenant (a stocker dans `tenant_settings.shopify_api_token` si pas deja la — A VERIFIER au demarrage de l'implementation).
   2. Si Shopify ne retourne rien, n'a pas de credentials, ou si le variant n'existe pas : fallback sur `tenant_customs_settings.default_hs_code`
   3. Si aucun default n'est configure cote tenant : `pending_manual` avec message "Configurer le code douanier par defaut pour ce client dans Reglages"
   4. `origin_country` = `tenant_customs_settings.default_origin_country` (FR par defaut)
- **Action API** : PUT /parcels/{id}
- **Statut applicable** : On Hold

### Pattern 4 — Poids trop bas

- **Detection** : `error_message ~ /weight.+greater than or equal to 0\.00099/i`
- **Diagnostic** : un parcel_item a un poids < 1g (produit digital ou erreur de saisie)
- **Fix** : forcer chaque `parcel_items[].weight = max(actual, 0.001)` (en kg, soit 1g minimum)
- **Action API** : PUT /parcels/{id}
- **Statut applicable** : On Hold

### Pattern 5 — Announcement failed 1002

- **Detection** : `status_id = 1002`
- **Diagnostic** : deja annonce, ne peut pas etre update via PUT (la doc Sendcloud le confirme)
- **Fix** :
   1. Tenter d'abord la detection des patterns 1-4 sur `error_message` (souvent vide ou generique). Si AUCUN pattern detecte -> bascule immediate en `pending_manual` (pas la peine de canceler et recreer avec les memes data, on echouera pareil)
   2. Si un pattern 1-4 est detecte : POST /parcels/{id}/cancel via Sendcloud API
   3. Si cancel OK : appliquer le fix sur les data en memoire, puis POST /parcels avec les data corrigees pour recreer le colis. Mettre a jour le `sendcloud_id` du shipment local pour pointer sur le nouveau colis.
   4. Si cancel KO (carrier refuse, hors fenetre 42j, status incompatible) : marquer `pending_manual` avec details dans `error_log`
- **Action API** : cancel + recreate
- **Statut applicable** : 1002

### Patterns inconnus

- Ce qui ne matche aucun des 5 ci-dessus -> log dans `auto_fixes(pattern='unknown', action='manual_required', status='pending_manual')`
- Permet de decouvrir de nouvelles familles d'erreur en regardant le dashboard
- Apres 3 tentatives infructueuses (sur les patterns connus aussi) -> bascule en `pending_manual`

## 6. Schema de base de donnees

### Table `auto_fixes`

```sql
CREATE TABLE auto_fixes (
   id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
   shipment_id     uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
   sendcloud_id    text NOT NULL,
   pattern         text NOT NULL CHECK (pattern IN (
      'currency_chf', 'address_too_long', 'hs_code_missing',
      'weight_too_low', 'announcement_failed_1002', 'unknown'
   )),
   action          text NOT NULL CHECK (action IN (
      'put_update', 'cancel_recreate', 'manual_required'
   )),
   before_json     jsonb,
   after_json      jsonb,
   status          text NOT NULL CHECK (status IN (
      'success', 'failed', 'pending_manual', 'manual_resolved'
   )),
   attempts        int NOT NULL DEFAULT 1,
   error_log       text,
   alerted_at      timestamptz,
   created_at      timestamptz NOT NULL DEFAULT now(),
   resolved_at     timestamptz
);

CREATE INDEX idx_auto_fixes_tenant_status_created
   ON auto_fixes (tenant_id, status, created_at DESC);
CREATE INDEX idx_auto_fixes_shipment ON auto_fixes (shipment_id);

ALTER TABLE auto_fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_fixes_tenant_isolation ON auto_fixes
   FOR ALL USING (tenant_id = get_tenant_id());
```

### Table `exchange_rates_cache`

```sql
CREATE TABLE exchange_rates_cache (
   base_currency   text NOT NULL,
   target_currency text NOT NULL,
   rate            numeric(10,6) NOT NULL,
   fetched_at      timestamptz NOT NULL DEFAULT now(),
   PRIMARY KEY (base_currency, target_currency)
);
```

Pas de RLS, table globale (taux de change identiques pour tous).

### Table `tenant_customs_settings`

```sql
CREATE TABLE tenant_customs_settings (
   tenant_id              uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
   default_hs_code        text,
   default_origin_country text NOT NULL DEFAULT 'FR',
   notes                  text,
   updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_customs_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_customs_settings_tenant_isolation ON tenant_customs_settings
   FOR ALL USING (tenant_id = get_tenant_id());

-- Seed pour tenants connus
INSERT INTO tenant_customs_settings (tenant_id, default_hs_code, notes) VALUES
   ('f1073a00-0000-4000-a000-000000000001', '21069098', 'Complements alimentaires Florna'),
   ('b69c0a80-fdaf-40d4-a5cc-a143eb5c4abe', '21069098', 'Complements alimentaires REBORN21')
ON CONFLICT DO NOTHING;
```

### Colonnes additionnelles sur `shipments`

```sql
ALTER TABLE shipments
   ADD COLUMN IF NOT EXISTS auto_fix_attempts int NOT NULL DEFAULT 0,
   ADD COLUMN IF NOT EXISTS auto_fix_last_attempt timestamptz;

CREATE INDEX idx_shipments_auto_fix_candidates
   ON shipments (tenant_id, status_id, auto_fix_attempts)
   WHERE (status_id = 1002 OR status_message = 'On Hold')
     AND auto_fix_attempts < 3;
```

### Table `auto_fix_state` (cooldown alertes)

```sql
CREATE TABLE auto_fix_state (
   tenant_id       uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
   last_alert_at   timestamptz,
   updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auto_fix_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_fix_state_tenant_isolation ON auto_fix_state
   FOR ALL USING (tenant_id = get_tenant_id());
```

## 7. Escalation et alertes

### Algorithme

A chaque fin de run du cron auto-fix, pour chaque tenant :

```
pending_count = COUNT(auto_fixes WHERE tenant_id = T 
                                  AND status = 'pending_manual' 
                                  AND alerted_at IS NULL)

if pending_count >= 5:
   last_alert = SELECT last_alert_at FROM auto_fix_state WHERE tenant_id = T
   if last_alert IS NULL OR last_alert < now() - INTERVAL '6 hours':
      send_alert(T, pending_count)
      UPDATE auto_fix_state SET last_alert_at = now() WHERE tenant_id = T
      UPDATE auto_fixes SET alerted_at = now() 
        WHERE tenant_id = T AND status = 'pending_manual' AND alerted_at IS NULL
```

### Canaux

Configurable par tenant via `tenant_settings` (table existante, ajouter colonnes) :
- `alert_email text` : adresse email pour notifications
- `alert_slack_webhook text` : URL d'un webhook Slack incoming

Si les deux sont configures, on envoie aux deux. Si aucun, on log un warning et on continue (l'UI dashboard reste la source de verite).

### Format

Email :
```
Objet : [MLC Auto-fix] 5 commandes a traiter manuellement pour <tenant>

Bonjour,

L'auto-fix Sendcloud n'a pas pu corriger 5 commandes sur les dernieres 6h. Une intervention manuelle est necessaire.

Voir le detail : https://app.homemade-elogistics.com/corrections-auto

- L'app
```

Slack : message similaire en blocs formates avec le compteur en accent.

## 8. Dashboard UI

Route : `/corrections-auto` (accessible role `admin` et `operateur`).

### Bandeau KPI (4 cards)

- **Total corrigees 24h** : COUNT(status='success' AND created_at > now() - 24h)
- **Total corrigees 30j** : meme avec 30j
- **En attente manuelle** : COUNT(status='pending_manual')
- **Taux de succes 30j** : success / (success + pending_manual) en %

### Onglet "A traiter manuellement" (par defaut)

Tableau des shipments en `pending_manual` :

| Sendcloud ID | Reference commande | Pattern tente | Raison echec | Date | Actions |
|--------------|-------------------|---------------|--------------|------|---------|
| 656132428 | 2026-20-14-782 | currency_chf | Cancel refuse par Colissimo | 21/05 14:32 | Retry / Marquer resolu |

- **Retry** : reset `auto_fix_attempts = 0` + appel immediat de `/api/auto-fix/retry/[id]`
- **Marquer resolu manuellement** : passe en `status = 'manual_resolved'` + `resolved_at = now()`

### Onglet "Historique"

Tous les `auto_fixes` avec filtres :
- Tenant (super admin seulement)
- Pattern
- Status (success / failed / pending_manual / manual_resolved)
- Periode (24h / 7j / 30j / personnalise)

Click sur une ligne -> dialog avec diff `before_json` vs `after_json` en JSON formate cote a cote.

Bouton "Export CSV" en haut a droite.

### Permissions

- Super admin : voit tous tenants
- Tenant admin / operateur : voit son tenant seulement (RLS standard)
- Tenant client / readonly : pas d'acces au menu

## 9. Strategie de tests

### Tests unitaires (Vitest)

- `detect.test.ts` : chaque pattern matche sur des exemples reels tires de la prod (fixtures depuis la DB actuelle)
- `fixes/currency.test.ts` : conversion CHF->EUR avec rate mocke, arrondis OK, parcel_items multiples
- `fixes/address.test.ts` : ~20 cas reels (vrais shipments en echec), abreviations, troncature, spillover
- `fixes/customs.test.ts` : Shopify present / absent / tenant default
- `fixes/weight.test.ts` : min weight 1g enforced

### Tests d'integration

- `apply.test.ts` mock Sendcloud (msw) : verifier le payload PUT, verifier la sequence cancel + recreate
- E2E DB : seed un shipment On Hold avec error_message, lancer `runAutoFix(tenantId)`, verifier `auto_fixes` row + appel Sendcloud mocke

### Validation sur donnees reelles (staging avant prod)

1. Brancher une Supabase staging
2. Dupliquer 50 shipments en echec de la prod actuelle dans staging
3. Lancer le job en mode `dry_run=true` (logge l'intention sans appeler Sendcloud)
4. Aurelien valide la liste avant qu'on bascule en mode reel
5. Activation progressive : flag `auto_fix_enabled` par tenant, Florna seul d'abord, puis extension

### Metriques a monitorer

- Taux d'erreur de l'endpoint `/api/auto-fix/run`
- Distribution des patterns par jour (combien de currency vs address vs customs)
- Latence moyenne d'un fix (objectif < 3s end-to-end)
- Taux d'escalade manuelle (objectif < 10%)

### Rollback plan

- Toggle global `AUTO_FIX_ENABLED=false` en env var Render -> arret immediat sans deploiement
- Toggle par tenant via UI super-admin (champ `tenant_settings.auto_fix_enabled`)
- Pas de modification destructive : `auto_fixes` table contient tout l'audit, on peut auditer / revert manuellement

## 10. Phasing recommande

### Phase 2.0 (livraison initiale, ~5-7 jours dev)

- Patterns 1-4 (On Hold via PUT)
- Pattern 5 (Announcement failed via cancel + recreate)
- Table auto_fixes + colonnes shipments + tenant_customs_settings
- Endpoint /api/auto-fix/run chaine apres le sync
- Dashboard avec KPI + pending_manual + historique basique
- Alertes email (Slack en option si webhook configure)
- Tests unitaires + integration sur les patterns

### Phase 2.5 (apres validation sur 30 jours)

- Affiner les regles d'abreviation adresse en fonction des cas reels rencontres
- Ajouter potentiellement de nouveaux patterns detectes via le bucket `unknown`
- Ajouter pre-validation en amont du webhook (si on veut intercepter Shopify -> Sendcloud)
- Reporting hebdo automatique envoye par email a Aurelien

## 11. Risques et mitigation

| Risque | Impact | Mitigation |
|--------|--------|------------|
| API BCE down -> pas de taux | Pattern 1 ne marche pas pendant l'incident | Cache 24h + fallback sur dernier taux connu + log warning |
| Sendcloud PUT refuse un colis "On Hold" | Le fix echoue | Capturer l'erreur, incrementer attempts, escalader si >= 3 |
| Cancel refuse par le carrier sur 1002 | Pattern 5 echoue partiellement | Marquer pending_manual, lister dans dashboard |
| Shopify API throttle | Pattern 3 ralenti | Cache des HS codes par variant_id (table separee, TTL 7 jours) |
| Bug dans l'auto-fix qui corrompt des commandes | Critique | Mode dry_run en staging avant prod + audit log complet + toggle off rapide |
| Fix applique mais Sendcloud renvoie une NOUVELLE erreur cascade | Boucle | Compteur attempts max 3 + last_attempt > 1h avant retry |

## 12. Estimation effort

- **Dev backend** : 3-4 jours (logique, fixes, apply, escalation)
- **Migrations + tests integration** : 1 jour
- **Dashboard UI** : 1-2 jours (table, dialog, KPI)
- **Tests unitaires + tests sur cas reels** : 1 jour
- **Validation staging + rollout progressif** : 1 jour

Total : 7 a 9 jours dev + tests, hors phasing client (validation Aurelien, observation prod).

## 13. Decisions a prendre / questions ouvertes

Aucune. Toutes les decisions ont ete validees durant le brainstorming du 21/05/2026.

Configurations a recuperer cote client avant deploiement :
- Florna : default_hs_code (suppose 21069098, a confirmer) et alert_email
- REBORN21 : default_hs_code (suppose 21069098, a confirmer) et alert_email
- Anteos, Motijet : default_hs_code a recuperer

## 14. Prochaines etapes

1. Validation de ce spec par l'utilisateur
2. Invocation du skill `writing-plans` pour generer le plan d'implementation detaille en taches sequentielles
3. Devis a presenter a Aurelien comme module "Resolution automatique erreurs Sendcloud" (echelle middleware ~1500-2000 EUR HT)
4. Demarrage implementation apres go client
