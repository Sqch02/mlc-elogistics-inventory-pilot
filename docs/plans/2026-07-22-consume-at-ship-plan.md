# Consume-at-Ship — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le stock ne doit être décompté qu'au moment où un colis quitte réellement l'entrepôt (expédié), jamais à la création / au statut On-Hold / à la génération d'étiquette.

**Architecture:** Introduire un prédicat unique « expédié / consommable » (une fonction SQL `is_consumable_shipment` + son miroir TS `isConsumableStatus`), et le brancher comme **verrou central dans la RPC `consume_shipment_stock`** pour que tout chemin qui passe par elle refuse un colis non expédié. Compléter par : (1) consommation à la **transition** vers « expédié » (aujourd'hui la conso ne se déclenche qu'à la première apparition), (2) reversal sur annulation/retour, (3) un **sweeper de réconciliation borné** filet de sécurité, (4) une **recalibration one-time revue** qui rend le stock des commandes historiquement consommées à tort (On-Hold / annulées), tenant par tenant.

**Tech Stack:** Next.js 14 App Router (TypeScript), Supabase Postgres (RPC plpgsql `SECURITY DEFINER`, RLS, service_role), Vitest, migrations SQL numérotées.

## Global Constraints

- **Aucune consommation/reversal de stock ne doit passer hors de `apply_stock_delta` / `consume_shipment_stock`** (atomicité, décomposition bundle, plancher `GREATEST(0,…)`, trace `stock_movements`). Le chemin legacy `shipments/create` qui écrit `stock_snapshots` en direct doit être migré, pas conservé.
- **Budget I/O borné — incident 13/07 :** `DEFAULT_CRON_MAX_PAGES=2` NE CHANGE PAS. Le sweeper est plafonné par batch (défaut 200 shipments/tenant/run), sérialisé par le lock bail `try_cron_tenant_lock`, coupable via `SYNC_PAUSED`. Le refresh des mat views reste **une seule fois en fin de run** (`refresh_all_analytics_views` / `ANALYTICS_REFRESH_RPCS`).
- **Ne PAS réactiver ni ajouter de triggers de remap** (`remap_on_sku_insert` / `remap_on_mapping_insert`) — note projet #21. Le remap est modifié seulement pour respecter le gate, pas re-déclenché.
- **La recalibration ne corrige QUE le stock consommé à tort par des lignes non-expédiées** (On-Hold / annulées, tracable au ledger). Elle **ne tente PAS** de corriger le surplus historique de double-consommation (indéterminable — décision projet actée, ne pas faire de reversion de masse).
- **Un seul emplacement source de vérité** pour le prédicat « consommable ». TS (`src/lib/stock/consumable-status.ts`) et SQL (`is_consumable_shipment`) doivent être testés pour rester équivalents.
- Migrations : `CREATE ... IF NOT EXISTS` / `CREATE OR REPLACE`, RLS + `REVOKE FROM PUBLIC, anon, authenticated` + `GRANT ... service_role` pour tout nouvel objet, `SET search_path=public` sur toute fonction `SECURITY DEFINER`.
- Commits : **aucune mention d'IA ni de `Co-Authored-By`.**
- Rollout **par tenant**, précédé d'un **backup** (point de restauration Supabase). Rollback = kill-switch + revert code (les migrations restent en place, inertes).

---

## Résumé exécutif (pour validation Aurélien)

**Le problème.** Aujourd'hui le stock est décompté dès qu'une commande apparaît dans le système — y compris les commandes « On-Hold » (étiquette générée mais colis pas encore parti). Quentin a confirmé (22/07) que (1) le stock ne doit bouger qu'à l'expédition réelle, et (2) les étiquettes générées puis non expédiées / annulées sont **fréquentes**. Résultat actuel : sur-consommation « fantôme » qui n'est jamais rendue → le stock affiché est plus bas que le stock réel. C'est aussi la cause racine de la dérive REBORN21 et du risque WM-2 sur la PR checkpoints.

**Le correctif.** Ne consommer qu'à l'expédition (mêmes commandes que celles déjà comptées par la facturation), consommer au moment où une commande passe « expédiée », rendre le stock sur annulation, un balayage de sécurité, et une **remise à niveau unique** du stock historique consommé à tort.

**Impact & risque.** Le changement **modifie les chiffres de stock de tous les clients** (dans le bon sens : le stock remonte de ce qui avait été retiré à tort). C'est pourquoi il est présenté pour signature avant tout déploiement. Déploiement progressif tenant par tenant, avec sauvegarde préalable, rapport chiffré revu avant application de la recalibration, et bouton d'arrêt instantané. Aucune écriture Sendcloud, aucun email. Effort estimé : ~4–6 jours dev (implémentation Codex + vérification + rollout surveillé).

**Ce qui n'est PAS touché.** Pas de correction du surplus historique de double-consommation (dossier séparé, indéterminable). Pas de changement de facturation, d'auth, de webhooks de sécurité. Pas de réactivation des triggers de remap.

---

## Décisions de conception verrouillées

1. **Prédicat « consommable » = MESSAGE-based, aligné sur la facturation (migration 00078).** ⚠️ **Corrigé après vérification des données prod (Phase 0, 22/07)** : `status_id IS NULL` n'est PAS un signal fiable de « pas expédié ». MOTIJET et Anteos sont des intégrations où les commandes expédiées restent `status_id = NULL` avec `status_message = 'Fulfilled'` / `'Completed'`. Un prédicat basé sur `status_id` casserait le stock de ces 2 clients. Le bon prédicat est donc **basé sur le message**, exactement comme la facturation : un colis consomme le stock ssi `is_return = false` ET `status_id` pas dans `(2000, 2001)` (colis Sendcloud annulés) ET `status_message` pas dans l'ensemble « pas expédié » `('On Hold','Unfulfilled','Processing','','Cancelled','Cancelled - customer')`. → stock et facturation partagent enfin une seule définition de « expédié », et les commandes d'intégration « Fulfilled/Completed » consomment bien.

2. **Verrou central dans `consume_shipment_stock`.** La RPC refuse (retourne `consumed=false`, ne pose pas `stock_consumed_at`) si le shipment n'est pas consommable. Tout chemin qui passe par la RPC hérite du gate. Les chemins qui la contournent (`recalculate`, `create` legacy, `remap_unmapped_items`) sont migrés pour passer par elle ou recevoir le même gate.

3. **Consommation à la transition, pas seulement à la création.** On remplace le gate `isNewShipment` par « consommable ET pas encore consommé (`stock_consumed_at IS NULL`) ET au moins un item mappé ». Le CAS sur `stock_consumed_at` garantit l'unicité. Une commande On-Hold n'est donc pas consommée à sa création ; elle le sera quand elle deviendra un vrai colis (transition NULL→status_id, ou remplacement UUID→numérique).

4. **Recalibration = restore revu, ledger-based, périmètre strict.** On ne rembobine QUE les shipments avec `stock_consumed_at IS NOT NULL` qui ne sont **pas** consommables (On-Hold / annulés). Le montant rendu par SKU = `-SUM(stock_movements.adjustment)` net (mouvements `movement_type='shipment'`), appliqué via `apply_stock_delta(+qty)`. Un **rapport dry-run par tenant est produit et revu** avant application.

### Découverte Phase 0 déjà exécutée (22/07, read-only) — impact chiffré

- **Impact recalibration (unités de stock rendues, prédicat corrigé) : FLORNA ≈ 1 826 (603 colis), Anteos = 1, MOTIJET = 0, REBORN21 = 0.** Modeste (FLORNA ~62k u/mois → ~3 % d'un mois), dans le bon sens (le stock remonte).
- **Découverte critique :** MOTIJET & Anteos laissent `status_id = NULL` sur des commandes expédiées (`status_message` = 'Fulfilled'/'Completed') → prédicat corrigé en message-based (cf Décision 1). Sans ça, on cassait le stock de ces 2 clients.
- **Triggers de remap : DÉSACTIVÉS en prod** (confirmé) — rien à réactiver.

### Décision restant à confirmer avec Quentin/Aurélien (vocabulaire des messages)

- **« Ready to send » (status_id 1000)** : 11 398 colis FLORNA (label créé mais peut-être pas encore physiquement remis). Défaut = consommable (cohérent facturation). Si on veut ne consommer qu'à « en transit », exclure l'ensemble d'annonce (1000/1001/1) — changement d'une ligne dans le prédicat.
- **« Announcement failed » (1002, ~821 consommés) et « Unknown status » (1337, ~755 consommés)** : expédiés ou non ? Défaut actuel = consommable ; à confirmer.
- **Messages d'intégration « Completed » / « Fulfilled » / « Processing » / vide** : confirmer avec Quentin que Completed/Fulfilled = expédié et Processing/vide = pas encore. (Codé ainsi par défaut.)

---

## Structure des fichiers

**Créés**
- `src/lib/stock/consumable-status.ts` — prédicat TS `isConsumableStatus` + constantes partagées.
- `src/lib/stock/consumable-status.test.ts` — tests table-driven du prédicat (miroir des cas SQL).
- `src/lib/stock/reconcile-stock.ts` — orchestration du sweeper borné (consume manquants / reverse à tort).
- `src/lib/stock/reconcile-stock.test.ts`.
- `supabase/migrations/00096_consume_at_ship_gate.sql` — `is_consumable_shipment()` + `consume_shipment_stock` v2 (gate) + gate dans `remap_unmapped_items`.
- `supabase/migrations/00097_stock_reconcile_and_recalibration.sql` — RPC `reconcile_tenant_stock` (sweeper borné) + `recalibrate_consumed_not_shipped_report` (dry-run) + `recalibrate_consumed_not_shipped_apply`.
- `docs/plans/2026-07-22-consume-at-ship-plan.md` — ce document.

**Modifiés**
- `src/app/api/sync/sendcloud/cron/route.ts` — gate de conso (`~575-588`, `~693-705`) + appel sweeper borné en fin de tenant.
- `src/app/api/webhooks/sendcloud/[tenantCode]/route.ts` — gate de conso (`413-423`), reversal aussi sur retour/annulation numérique.
- `src/app/api/sync/sendcloud/run/route.ts` — gate de conso (`177-184`) + corriger la divergence `isNewShipment` (tester `sendcloud_id` **avec** `tenant_id`, `119-123`).
- `src/app/api/stock/recalculate/route.ts` — filtrer les shipments non-consommables ; router par `consume_shipment_stock`.
- `src/app/api/shipments/create/route.ts` — remplacer le read-modify-write direct (`211-270`) par `apply_stock_delta` et **ne consommer qu'à l'expédition** (un colis créé mais pas encore expédié ne consomme pas).
- `src/app/api/shipments/[id]/cancel/route.ts` — déclencher le reversal (`restockShipmentStock`) à l'annulation UI (aujourd'hui ne rend rien).
- `src/lib/stock/consume.ts` — inchangé sur le cœur ; ajouter un helper `restockShipmentStock` idempotent déjà présent (réutilisé par le sweeper).

---

## Phase 0 — Découverte & verrouillage des décisions (AVANT tout code)

But : lever les 3 inconnues réelles avec des données de prod, et faire signer le périmètre. Aucune écriture.

### Task 0.1 : Distribution réelle des statuts

- [ ] **Step 1 : exécuter (read-only, via MCP / SQL editor), par tenant :**

```sql
SELECT status_id, status_message, is_return,
       count(*) AS n,
       count(*) FILTER (WHERE stock_consumed_at IS NOT NULL) AS consumed
FROM shipments
GROUP BY status_id, status_message, is_return
ORDER BY n DESC;
```

- [ ] **Step 2 :** classer chaque `(status_id, status_message)` en `consommable` / `non-consommable` avec Quentin+Aurélien. Confirmer le sort du cas « Ready to send » (1000) / annoncé (1). Figer la liste dans le prédicat (Task 1.1).

### Task 0.2 : Taille du chantier de recalibration (impact chiffré)

- [ ] **Step 1 : compter le stock consommé à tort, par tenant et par SKU (read-only) :**

```sql
SELECT s.tenant_id, sm.sku_id,
       -sum(sm.adjustment) AS units_to_restore,
       count(DISTINCT s.id) AS shipments
FROM stock_movements sm
JOIN shipments s ON s.id = sm.reference_id
WHERE sm.reference_type = 'shipment'
  AND sm.movement_type = 'shipment'
  AND s.stock_consumed_at IS NOT NULL
  AND s.is_return = false
  AND (
    s.status_id IS NULL
    OR s.status_id IN (2000, 2001)
    OR s.status_message IN ('On Hold','Cancelled','Cancelled - customer','Unfulfilled')
  )
GROUP BY s.tenant_id, sm.sku_id
HAVING -sum(sm.adjustment) <> 0
ORDER BY units_to_restore DESC;
```

- [ ] **Step 2 :** produire le total par tenant (unités à rendre) et le présenter dans le dossier de signature Aurélien. C'est l'ordre de grandeur de la correction visible côté client.

### Task 0.3 : État des triggers de remap en prod

- [ ] **Step 1 :** vérifier l'état réel (activé/désactivé) des triggers `remap_on_sku_insert` / `remap_on_mapping_insert` :

```sql
SELECT tgname, tgenabled, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE 'remap_%';
```

- [ ] **Step 2 :** confirmer que le gate ajouté à `remap_unmapped_items` (Task 2.4) n'implique **aucune** réactivation de trigger. Documenter l'état constaté.

**Gate de sortie Phase 0 :** prédicat figé (0.1), impact chiffré présenté & signé par Aurélien (0.2), état triggers documenté (0.3). Pas d'implémentation avant cette signature.

---

## Phase 1 — Prédicat « consommable » (source de vérité unique)

### Task 1.1 : Prédicat TS

**Files:**
- Create: `src/lib/stock/consumable-status.ts`
- Test: `src/lib/stock/consumable-status.test.ts`

**Interfaces:**
- Produces: `isConsumableStatus(row: { status_id: number | null; status_message: string | null; is_return: boolean | null }): boolean`, `NON_CONSUMABLE_STATUS_MESSAGES`, `CANCELLED_STATUS_IDS`.

- [ ] **Step 1 : test qui échoue**

```ts
import { describe, it, expect } from 'vitest'
import { isConsumableStatus } from './consumable-status'

describe('isConsumableStatus', () => {
  const cases: Array<[string, { status_id: number | null; status_message: string | null; is_return: boolean | null }, boolean]> = [
    ['On-Hold integration (status_id null)', { status_id: null, status_message: 'On Hold', is_return: false }, false],
    ['Unfulfilled integration', { status_id: null, status_message: 'Unfulfilled', is_return: false }, false],
    ['Processing integration', { status_id: null, status_message: 'Processing', is_return: false }, false],
    ['empty message integration', { status_id: null, status_message: '', is_return: false }, false],
    ['MOTIJET Fulfilled (status_id null MAIS expédié)', { status_id: null, status_message: 'Fulfilled', is_return: false }, true],
    ['MOTIJET/Anteos Completed (status_id null MAIS expédié)', { status_id: null, status_message: 'Completed', is_return: false }, true],
    ['cancelled numeric 2000', { status_id: 2000, status_message: 'Annulé', is_return: false }, false],
    ['refused numeric 2001', { status_id: 2001, status_message: 'Refusé', is_return: false }, false],
    ['delivered numeric 11', { status_id: 11, status_message: 'Delivered', is_return: false }, true],
    ['ready to send numeric 1000 (défaut=consommable, cf Phase 0)', { status_id: 1000, status_message: 'Ready to send', is_return: false }, true],
    ['in transit numeric 3', { status_id: 3, status_message: 'En route to sorting center', is_return: false }, true],
    ['return line always excluded', { status_id: 11, status_message: 'Delivered', is_return: true }, false],
    ['cancelled by message', { status_id: null, status_message: 'Cancelled - customer', is_return: false }, false],
  ]
  it.each(cases)('%s', (_label, row, expected) => {
    expect(isConsumableStatus(row)).toBe(expected)
  })
})
```

- [ ] **Step 2 : lancer, vérifier l'échec** — `npx vitest run src/lib/stock/consumable-status.test.ts` → FAIL (module absent).

- [ ] **Step 3 : implémentation minimale**

```ts
// Un shipment "consommable" = il a physiquement quitté l'entrepôt.
// Aligné sur le prédicat "expédié" de la facturation/analytics (migration 00078).
// IMPORTANT : basé sur le MESSAGE, pas sur status_id. Les intégrations MOTIJET/Anteos
// laissent status_id NULL sur des commandes pourtant expédiées (message 'Fulfilled'/'Completed').
// On exclut donc les états "pas expédié" par message + les colis Sendcloud annulés par id.
export const NON_CONSUMABLE_STATUS_MESSAGES = [
  'On Hold',
  'Unfulfilled',
  'Processing',
  '',
  'Cancelled',
  'Cancelled - customer',
] as const

export const CANCELLED_STATUS_IDS = [2000, 2001] as const

export function isConsumableStatus(row: {
  status_id: number | null
  status_message: string | null
  is_return: boolean | null
}): boolean {
  if (row.is_return) return false
  if (row.status_id !== null && (CANCELLED_STATUS_IDS as readonly number[]).includes(row.status_id)) {
    return false
  }
  const msg = row.status_message ?? ''
  if ((NON_CONSUMABLE_STATUS_MESSAGES as readonly string[]).includes(msg)) return false
  return true
}
```

- [ ] **Step 4 : lancer, vérifier le succès** — même commande → PASS.

- [ ] **Step 5 : commit** — `git add … && git commit -m "feat(stock): add shared isConsumableStatus predicate"`

### Task 1.2 : Prédicat SQL miroir + migration 00096 (fonction seule d'abord)

**Files:**
- Create: `supabase/migrations/00096_consume_at_ship_gate.sql`

**Interfaces:**
- Produces: `public.is_consumable_shipment(p_status_id int, p_status_message text, p_is_return boolean) RETURNS boolean` (IMMUTABLE).

- [ ] **Step 1 : écrire la fonction dans la migration**

```sql
-- Prédicat "consommable" partagé (miroir SQL de src/lib/stock/consumable-status.ts).
CREATE OR REPLACE FUNCTION public.is_consumable_shipment(
  p_status_id integer,
  p_status_message text,
  p_is_return boolean
) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  -- MESSAGE-based (cf données prod Phase 0) : status_id NULL n'implique PAS "pas expédié"
  -- (MOTIJET/Anteos 'Fulfilled'/'Completed' = expédiés). On exclut les états "pas expédié"
  -- par message + les colis Sendcloud annulés par id.
  SELECT COALESCE(p_is_return, false) = false
     AND (p_status_id IS NULL OR p_status_id NOT IN (2000, 2001))
     AND COALESCE(p_status_message, '') NOT IN
         ('On Hold','Unfulfilled','Processing','','Cancelled','Cancelled - customer');
$$;

REVOKE ALL ON FUNCTION public.is_consumable_shipment(integer, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_consumable_shipment(integer, text, boolean) TO service_role;
```

- [ ] **Step 2 : test d'équivalence TS↔SQL** — ajouter à `consumable-status.test.ts` un tableau de vecteurs partagé (les 8 cas) qui documente que la logique SQL applique la même règle (vérif manuelle en revue + test d'intégration DB en Task 5.3). Commit.

---

## Phase 2 — Verrou central & gate de tous les chemins de conso

### Task 2.1 : Gate dans `consume_shipment_stock` (migration 00096)

**Files:**
- Modify: `supabase/migrations/00096_consume_at_ship_gate.sql` (ajout de la RPC v2)

**Interfaces:**
- Consumes: `is_consumable_shipment(...)` (Task 1.2).
- Produces: `consume_shipment_stock(p_tenant_id uuid, p_shipment_id uuid) RETURNS TABLE(consumed boolean, item_count integer)` — signature inchangée, comportement : refuse si non consommable.

- [ ] **Step 1 : réécrire la RPC en gardant tout le reste identique à 00085**

```sql
CREATE OR REPLACE FUNCTION public.consume_shipment_stock(
  p_tenant_id uuid,
  p_shipment_id uuid
) RETURNS TABLE(consumed boolean, item_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_claimed integer;
  v_count integer := 0;
  v_status_id integer;
  v_status_message text;
  v_is_return boolean;
  r record;
BEGIN
  -- Garde tenant (inchangée vs 00085).
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin()
     AND p_tenant_id <> public.get_tenant_id() THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  -- NOUVEAU : verrou consume-at-ship. On ne consomme que les colis expédiés.
  SELECT status_id, status_message, is_return
    INTO v_status_id, v_status_message, v_is_return
  FROM shipments
  WHERE id = p_shipment_id AND tenant_id = p_tenant_id;

  IF NOT FOUND OR NOT public.is_consumable_shipment(v_status_id, v_status_message, v_is_return) THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- CAS idempotent (inchangé vs 00085).
  UPDATE shipments SET stock_consumed_at = now()
  WHERE id = p_shipment_id AND tenant_id = p_tenant_id AND stock_consumed_at IS NULL;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  FOR r IN SELECT sku_id, qty FROM shipment_items WHERE shipment_id = p_shipment_id LOOP
    PERFORM public.apply_stock_delta(
      p_tenant_id, r.sku_id, -r.qty, 'Expedition', p_shipment_id, 'shipment', NULL, 'shipment');
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT true, v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_shipment_stock(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_shipment_stock(uuid, uuid) TO service_role;
```

- [ ] **Step 2 : test DB** (Task 5.3 le couvre en intégration) — un shipment On-Hold (status_id NULL) → `consumed=false`, `stock_consumed_at` reste NULL, aucun `stock_movements`. Un shipment livré → `consumed=true`. Commit la migration.

### Task 2.2 : Gate du chemin CRON

**Files:**
- Modify: `src/app/api/sync/sendcloud/cron/route.ts` (`575-588` calcul candidats, `693-705` gate)

**Interfaces:**
- Consumes: `isConsumableStatus` (Task 1.1).

- [ ] **Step 1 : étendre la lecture pré-upsert** — au SELECT des `sendcloud_id` existants (`575-588`), récupérer aussi `stock_consumed_at` afin de connaître l'état de conso des lignes déjà en base.

- [ ] **Step 2 : remplacer le gate `693`** — de :

```ts
if (newSendcloudIds.has(parcel.sendcloud_id) && mappedCount > 0) {
```
à :
```ts
const alreadyConsumed = existingConsumedAt.get(parcel.sendcloud_id) != null
if (
  isConsumableStatus({ status_id: row.status_id, status_message: row.status_message, is_return: row.is_return }) &&
  !alreadyConsumed &&
  mappedCount > 0
) {
```

(La RPC reste le backstop : même si le prédicat TS laisse passer un cas limite, `consume_shipment_stock` refusera.) On ne dépend plus de `isNewShipment` → une commande qui passe On-Hold→expédiée est consommée au tick où elle devient consommable.

- [ ] **Step 3 : test** — `cron/route` test : un batch avec une ligne On-Hold mappée → `consumeShipmentStockOnce` NON appelée ; la même ligne repassée en statut expédié au tick suivant → appelée une fois. (mock `consumeShipmentStockOnce`.)

- [ ] **Step 4 : lancer les tests, commit.**

### Task 2.3 : Gate des chemins WEBHOOK et RUN

**Files:**
- Modify: `src/app/api/webhooks/sendcloud/[tenantCode]/route.ts` (`413-423`)
- Modify: `src/app/api/sync/sendcloud/run/route.ts` (`119-123`, `177-184`)

- [ ] **Step 1 (webhook) :** remplacer `if (isNewShipment && mappedCount > 0)` par `if (isConsumableStatus(shipmentRow) && shipmentRow.stock_consumed_at == null && mappedCount > 0)`. Le webhook `parcel_status_changed` déclenche donc la conso au passage à « expédié ».
- [ ] **Step 2 (run) :** même remplacement ; **et corriger la divergence** — le test d'existence `119-123` doit filtrer `sendcloud_id` **avec** `tenant_id` (aligné cron/webhook).
- [ ] **Step 3 :** tests unitaires des deux routes (On-Hold → pas de conso ; transition → 1 conso ; idempotent au rappel via CAS). Commit.

### Task 2.4 : Gate du remap rétroactif

**Files:**
- Modify: `supabase/migrations/00096_consume_at_ship_gate.sql` (recréer `remap_unmapped_items` (uuid) et (uuid,int))

- [ ] **Step 1 :** recréer les deux overloads de `remap_unmapped_items` en enveloppant le `apply_stock_delta(-qty)` par le gate : ne consommer un item nouvellement mappé que si son shipment est consommable **et** `stock_consumed_at` n'est pas déjà posé ; sinon insérer l'item dans `shipment_items` sans consommer (il sera consommé à l'expédition par le sweeper/transition, via `consume_shipment_stock`). Conserver la garde tenant et les bornes (limite 2000) existantes.
- [ ] **Step 2 :** test DB — un unmapped résolu sur une commande On-Hold → item ajouté, **pas** de mouvement de stock ; sur une commande expédiée non encore consommée → conso. Commit.

### Task 2.5 : Chemins legacy `create` et `recalculate`

**Files:**
- Modify: `src/app/api/shipments/create/route.ts` (`211-270`)
- Modify: `src/app/api/stock/recalculate/route.ts` (`50-109`)

- [ ] **Step 1 (create) :** supprimer le read-modify-write direct sur `stock_snapshots`. Le colis créé via l'UI n'est pas encore expédié → **ne pas consommer à la création**. La conso viendra du webhook/sync à l'expédition (via `consume_shipment_stock`). Si un cas métier exige une conso immédiate, la faire via `consumeShipmentStockOnce` (donc soumise au gate) et jamais en direct.
- [ ] **Step 2 (recalculate) :** filtrer la liste des shipments candidats sur `isConsumableStatus` (exclure On-Hold/annulés) et router la consommation par `consume_shipment_stock` (pose `stock_consumed_at`, décompose les bundles) au lieu de `consumeStock` par item. Conserver `requireRole(['super_admin','admin','ops'])`.
- [ ] **Step 3 :** tests des deux routes. Commit.

---

## Phase 3 — Reversal sur annulation / retour

### Task 3.1 : Reversal à l'annulation UI

**Files:**
- Modify: `src/app/api/shipments/[id]/cancel/route.ts` (`89-107`)

- [ ] **Step 1 :** après la mise à jour `status_id=2000`, appeler `restockShipmentStock(tenantId, shipmentId)` (déjà idempotent : CAS reset `stock_consumed_at`). Un colis annulé qui avait consommé est rendu ; s'il n'avait pas consommé, no-op.
- [ ] **Step 2 :** test — annulation d'un colis consommé → stock rendu une fois ; ré-annulation → no-op. Commit.

### Task 3.2 : Reversal webhook élargi (retours)

**Files:**
- Modify: `src/app/api/webhooks/sendcloud/[tenantCode]/route.ts` (`252-297`)

- [ ] **Step 1 :** en plus de `parcel_cancelled`, traiter le passage d'un colis précédemment consommable vers un statut annulé (status_id 2000/2001) détecté sur `parcel_status_changed` → `restockShipmentStock`. (Les retours `is_return=true` ne consomment jamais, donc rien à rembobiner de ce côté.)
- [ ] **Step 2 :** test. Commit.

---

## Phase 4 — Sweeper de réconciliation borné (filet de sécurité)

Objectif : rattraper deux dérives sans dépendre d'un événement temps-réel — (A) shipments **consommables, mappés, `stock_consumed_at IS NULL`** → consommer ; (B) shipments **non-consommables avec `stock_consumed_at IS NOT NULL`** → rembobiner. Borné, sérialisé, coupable.

### Task 4.1 : RPC `reconcile_tenant_stock` (migration 00097)

**Files:**
- Create: `supabase/migrations/00097_stock_reconcile_and_recalibration.sql`

**Interfaces:**
- Produces: `reconcile_tenant_stock(p_tenant_id uuid, p_limit integer DEFAULT 200) RETURNS TABLE(consumed_count integer, reversed_count integer)`.

- [ ] **Step 1 :** écrire la RPC : sélectionner au plus `p_limit` shipments récents à corriger (via l'index partiel `idx_shipments_stock_consumed_at_null` pour le cas A), et pour chacun appeler `consume_shipment_stock` (cas A) ou la logique de reversal (cas B, réutiliser le motif `reverse_duplicate_shipment_stock` **sans DELETE**). Verrou `FOR UPDATE SKIP LOCKED` sur le lot. `SECURITY DEFINER`, `SET search_path=public`, `REVOKE … / GRANT service_role`.
- [ ] **Step 2 :** test DB (Task 5.3). Commit.

### Task 4.2 : Orchestration TS bornée + branchement cron

**Files:**
- Create: `src/lib/stock/reconcile-stock.ts`, `src/lib/stock/reconcile-stock.test.ts`
- Modify: `src/app/api/sync/sendcloud/cron/route.ts` (après `reconcileTenant`, avant release lock)

**Interfaces:**
- Produces: `reconcileTenantStock(adminClient, tenantId, limit?): Promise<{ consumed: number; reversed: number }>`.

- [ ] **Step 1 :** wrapper TS qui appelle `reconcile_tenant_stock` avec `limit` par défaut 200, réutilise `getAdminDb`, respecte le kill-switch (ne rien faire si `SYNC_PAUSED==='true'`), et s'exécute **sous le lock tenant déjà tenu par le cron**.
- [ ] **Step 2 :** brancher dans la boucle tenant du cron, après la sync, avant le release du lock, dans un try/catch isolé (une erreur sweeper ne casse pas la sync). Le refresh mat views reste l'unique appel de fin de run.
- [ ] **Step 3 :** tests (borne respectée, no-op si SYNC_PAUSED). Commit.

---

## Phase 5 — Recalibration one-time revue (stock historique)

Périmètre STRICT : rendre le stock consommé à tort par des lignes **non-expédiées** (On-Hold / annulées). **Ne touche pas** au surplus de double-consommation historique.

### Task 5.1 : RPC rapport dry-run (migration 00097)

**Interfaces:**
- Produces: `recalibrate_consumed_not_shipped_report(p_tenant_id uuid) RETURNS TABLE(sku_id uuid, units_to_restore integer, shipment_count integer)`.

- [ ] **Step 1 :** implémenter la requête de la Task 0.2 comme RPC (lecture seule), par tenant, retournant les unités à rendre par SKU. `SECURITY DEFINER`, service_role.
- [ ] **Step 2 :** test DB. Commit.

### Task 5.2 : RPC application revue (migration 00097)

**Interfaces:**
- Produces: `recalibrate_consumed_not_shipped_apply(p_tenant_id uuid, p_expected_total integer) RETURNS TABLE(skus_restored integer, units_restored integer)`.

- [ ] **Step 1 :** implémenter : recompute le total attendu, **refuser si `p_expected_total` ne correspond pas** (garde-fou anti-dérive entre le rapport revu et l'application). Pour chaque SKU, `apply_stock_delta(+units, 'Recalibration consume-at-ship', NULL, 'recalibration', p_user_id, 'manual')`, puis `UPDATE shipments SET stock_consumed_at = NULL` pour les shipments concernés (ils pourront re-consommer proprement s'ils deviennent expédiés). Verrou `FOR UPDATE`, transaction unique par tenant. `SECURITY DEFINER`, service_role.
- [ ] **Step 2 :** test DB — idempotent (2e passage → 0 unité, car plus rien de non-consommable n'a `stock_consumed_at`). Commit.

### Task 5.3 : Suite de tests d'intégration DB (branche Supabase)

- [ ] **Step 1 :** monter une branche Supabase de test (ou base locale), rejouer 00096+00097, insérer des fixtures (On-Hold consommé, expédié consommé, annulé, bundle) et vérifier bout-en-bout : gate, transition, reversal, sweeper, report/apply. Commit.

---

## Phase 6 — Rollout par tenant & surveillance

### Task 6.1 : Backup & application des migrations

- [ ] **Step 1 :** point de restauration Supabase.
- [ ] **Step 2 :** appliquer 00096 puis 00097 (additives/idempotentes). Vérifier présence des fonctions + grants (`is_consumable_shipment`, RPC) et `REVOKE anon/authenticated` effectif.

### Task 6.2 : Déploiement code (gate actif, sweeper actif, recalibration NON lancée)

- [ ] **Step 1 :** merger le code (gate + sweeper). À partir de là, **plus aucune nouvelle sur-conso** ne se crée. Le sweeper commence à réconcilier au fil de l'eau, borné.
- [ ] **Step 2 :** surveiller 1–2 cycles : `/api/health/sync`, lignes `sync_runs`, latence I/O (aucun pic), volume de `stock_movements` par run (borné). Kill-switch `SYNC_PAUSED` prêt.

### Task 6.3 : Recalibration tenant par tenant (revue avant application)

- [ ] **Step 1 :** pour chaque tenant, dans l'ordre (petit tenant d'abord, ex. ANTEOS, puis FLORNA/REBORN21) : exécuter `recalibrate_consumed_not_shipped_report`, présenter le total à Maxime (et Aurélien si volume élevé).
- [ ] **Step 2 :** appliquer `recalibrate_consumed_not_shipped_apply(tenant, total_revu)` — refuse si le total a bougé.
- [ ] **Step 3 :** `SELECT public.refresh_all_analytics_views();` (rafraîchit `v_physical_shipment_items`, `mv_dashboard_daily`, `mv_sku_metrics`).
- [ ] **Step 4 :** vérifier le stock avant/après sur quelques SKU témoins avec Quentin. Passer au tenant suivant seulement si cohérent.

---

## Risques & garde-fous

- **I/O (incident 13/07) :** sweeper borné (200/run/tenant), sous lock tenant, `SYNC_PAUSED` coupable, refresh mat views 1×/run inchangé, `DEFAULT_CRON_MAX_PAGES=2` inchangé.
- **Sur-restore par le plancher `GREATEST(0)` :** possible seulement si un SKU a réellement touché 0 pendant la conso à tort ; le rapport dry-run rend l'ampleur visible SKU par SKU avant application ; garde-fou `p_expected_total`.
- **Prédicat trop/pas assez strict :** isolé dans une fonction unique (TS+SQL), ajustable en une ligne après la Phase 0 ; la RPC reste le backstop même si le pré-filtre TS diverge.
- **Cohérence stock↔facturation :** le prédicat réutilise l'ensemble d'exclusion de la facturation (00078) → alignement par construction.
- **Multi-tenant :** correction de la divergence `run/route.ts` (test d'existence sans `tenant_id`) incluse (Task 2.3).
- **Périmètre recalibration :** strictement les lignes non-expédiées consommées à tort ; jamais le surplus de double-conso historique (décision projet).

## Self-review (couverture vs objectif)

- Gate sur **tous** les chemins de conso : cron (2.2), webhook (2.3), run (2.3), remap (2.4), create+recalculate legacy (2.5), + verrou central RPC (2.1). ✅
- Conso à la **transition** vers expédié : abandon du gate `isNewShipment` au profit de `consommable && stock_consumed_at IS NULL` + CAS (2.2/2.3). ✅
- **Reversal** annulation/retour : UI (3.1) + webhook élargi (3.2). ✅
- **Sweeper borné** : RPC + orchestration + branchement cron (4.1/4.2). ✅
- **Recalibration one-time revue** : report + apply gardé + refresh (5.1/5.2/6.3). ✅
- **Rollout par tenant + I/O + backup + kill-switch** : Phase 6. ✅
- Résout **WM-2** (On-Hold ne consomme plus), **WM-1** (sweeper re-drive les consommables non consommés), **dérive REBORN21** (conso au bon moment), **sur-conso fantôme** (étiquettes non expédiées). ✅
- Décisions ouvertes réelles isolées en **Phase 0** avec requêtes de découverte et gate de signature. ✅
