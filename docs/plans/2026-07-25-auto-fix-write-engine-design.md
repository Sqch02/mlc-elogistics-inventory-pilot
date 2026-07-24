# Moteur d'écriture auto-fix — conception (V1)

**But :** faire passer l'auto-fix de « détecte et simule » à « corrige réellement chez Sendcloud », sans jamais pouvoir corrompre une expédition ni le stock.

**Statut :** conception à valider avant écriture de code. Rien n'est implémenté.

---

## 1. Ce qui existe déjà (vérifié dans la base et le code)

La fondation (migration 00093) est **déjà prête pour le live**, ce n'est pas à refaire :

- `auto_fix_jobs.mode` accepte `'simulated' | 'live'`.
- Les états `applied` et `verified` existent déjà dans la contrainte d'état.
- `original_sendcloud_id`, `result_sendcloud_id`, `error_category` (`retryable | non_retryable | configuration | internal | unknown`), `attempt_count`, `next_attempt_at`, `locked_until`, `worker_id` : présents.
- `auto_fixes.action` accepte déjà `put_update` et `create_linked` ; `auto_fixes.status` accepte `applied` et `verified`.
- `claim_auto_fix_jobs` fait bien le `SELECT ... FOR UPDATE SKIP LOCKED` **et** l'`UPDATE claimed` dans une seule instruction (CTE) : la réclamation est atomique.
- `buildOperationKey` inclut le `mode` : **un job dry-run et un job live sur la même expédition ont des clés différentes**, donc une simulation ne peut jamais bloquer l'opération live ultérieure. Invariant du plan satisfait.
- Le contrat d'écriture `PUT /api/v2/parcels` avec `{ parcel: { id, ...patch } }` a été validé sur un colis de test Anteos.

**Ce qui manque** : le chemin live des RPC (elles refusent aujourd'hui tout mode ≠ `simulated`), l'appel d'écriture Sendcloud, et la boucle worker live.

---

## 2. Périmètre V1

**Inclus :**

| Pattern | Action | Pourquoi |
|---|---|---|
| `address_too_long` | `put_update` | Le plus simple, le moins risqué : on tronque/reformate un champ texte. **Armé en premier.** |
| `currency_chf` | `put_update` | Calcul déjà vérifié (taux figé + date + arrondis + cohérence total/items). **Armé en second, après observation.** |

**Exclus, volontairement :**

- **Integration shipments (UUID)** → restent `pending_manual`. La « création liée via `shipment_uuid` » et l'effet sur la boutique ne sont pas validés. **V1 n'écrit que sur des colis numériques.**
- **Colis déjà annoncés** → un `PUT` n'a plus d'effet garanti. Refus explicite, pas de tentative.
- `hs_code_missing`, `weight_too_low` → détecteur et planner seulement, **écriture désactivée** (aucun cas réel sur 120 jours).
- `sender_eori_missing` → **jamais d'auto-fix** (configuration légale du compte) : alerte dédupliquée par tenant.
- `service_point_missing` → bloqué tant que Sendcloud n'a pas activé les Service Points.
- `unknown`, 1002 → hors lot.
- **cancel + recreate** → hors V1, catégoriquement.

---

## 3. Machine à états et reprise après crash

C'est le cœur de la sûreté. L'ordre est **non négociable** :

```
queued → claimed → planned → applied → verified
                       ↓         ↓
                  pending_manual / retry_wait / permanent_failed
```

**La règle qui rend un crash inoffensif :** l'état `applied` est persisté **avant** la relecture de vérification, et **immédiatement après** le retour de l'écriture Sendcloud.

Conséquence, et c'est le point le plus important de cette conception :

> Un job repris en état `applied` **ne doit JAMAIS être ré-écrit**. Il doit reprendre à l'étape de vérification.

Sans cette règle, un crash entre l'écriture et la vérification provoquerait une seconde écriture. Le worker teste donc l'état **avant** de décider quoi faire, il ne rejoue pas la séquence depuis le début.

**Cas du résultat réseau incertain** (timeout après l'envoi) : on ne rejoue pas l'écriture. On passe en vérification par relecture ; c'est elle qui tranche si le patch est passé ou non.

---

## 4. Contrats des RPC à créer (migration 00101)

Tout est `SECURITY DEFINER`, `SET search_path = public`, `REVOKE FROM PUBLIC, anon, authenticated`, `GRANT service_role`.

**`claim_auto_fix_jobs`** — étendue, pas dupliquée :

```
claim_auto_fix_jobs(p_tenant_id uuid, p_limit int DEFAULT 5,
                    p_lock_seconds int DEFAULT 120, p_worker_id text DEFAULT NULL,
                    p_mode text DEFAULT 'simulated')
```
Le paramètre est ajouté **en dernier avec une valeur par défaut** : les appels existants restent valides. Le filtre devient `j.mode = p_mode AND ts.auto_fix_mode = p_mode` — un job live n'est réclamable que si le tenant est lui-même en `live`. La priorité des flags reste : `AUTO_FIX_PAUSED` global → tenant `off` → `simulated` → `live`.

**`plan_auto_fix_live(p_job_id, p_worker_id, p_plan)` → bool**
`claimed → planned`. Refuse si `mode ≠ 'live'`, si le worker n'est pas propriétaire du verrou, ou si le plan ne porte pas une action autorisée en V1.

**`mark_auto_fix_applied(p_job_id, p_worker_id, p_result_sendcloud_id, p_after)` → bool**
`planned → applied`. Écrit la ligne `auto_fixes` avec `status='applied'`. **Appelée juste après le retour de l'écriture, avant toute vérification.**

**`verify_auto_fix_live(p_job_id, p_worker_id, p_verification)` → bool**
`applied → verified`. Passe la ligne `auto_fixes` correspondante à `status='verified'`. N'accepte que si la relecture confirme le patch.

**`fail_auto_fix_live(p_job_id, p_worker_id, p_error)` → text**
Route selon `error_category` :
- `retryable` → `retry_wait`, `next_attempt_at = now() + backoff exponentiel` (5, 10, 20, 40 min, plafonné à 60), `permanent_failed` au-delà de 3 tentatives ;
- `non_retryable` / `configuration` → `pending_manual` immédiatement, **sans retry** ;
- `internal` / `unknown` → `retry_wait` une seule fois, puis `pending_manual`.

**`get_auto_fix_live_tenants(p_limit int DEFAULT 20)`** — miroir de la version simulated, filtrée sur `auto_fix_mode = 'live'`.

---

## 5. Écriture Sendcloud

⚠️ **Vérifié dans le code, et ce n'est pas ce que je supposais.** Une fonction `updateParcel` existe déjà (`client.ts:812`), mais elle utilise le chemin **legacy** `PUT /api/v2/parcels/{id}` — pas le contrat validé par le spike. Et elle a **un appelant vivant** : la route de modification depuis l'interface (`shipments/[id]/update/route.ts:125`).

Conséquence sur la conception : **on ne modifie pas `updateParcel`**. Changer le contrat d'une fonction déjà utilisée en production serait un changement de comportement sur un chemin qui n'a rien demandé. Le moteur reçoit **sa propre fonction d'écriture**, testée pour lui :

`patchParcelById(credentials, { id, patch })` :

- `PUT {SENDCLOUD_API_URL}/parcels`, corps `{ parcel: { id, ...patch } }` — le contrat validé sur colis de test Anteos (`SENDCLOUD_API_URL` vaut déjà `https://panel.sendcloud.sc/api/v2`, donc l'URL finale est bien `/api/v2/parcels`, sans identifiant dans le chemin).
- Le chemin legacy `/parcels/{id}` reste **un repli**, jamais un premier choix, et seulement après un échec non ambigu suivi d'un `GET` de contrôle — conformément au plan.
- Le type `UpdateParcelData` existant couvre déjà les champs nécessaires (`address`, `address_2`, `city`, `postal_code`, `parcel_items`, `weight`) : il est réutilisé, pas dupliqué.
- `redirect: 'error'` (cohérent avec le durcissement SSRF de tous les autres appels).
- Timeout explicite. Un timeout est **`retryable` seulement au sens de la vérification** : on ne réécrit pas, on relit.
- **Jamais de bascule automatique v2 → v3.** Si v2 est indisponible, le job part en `pending_manual` : un changement de contrat d'API est une décision humaine.
- Classification des réponses : `4xx` de validation → `non_retryable` ; `401/403` → `configuration` ; `429` et `5xx` → `retryable` ; réseau/timeout → traité par la relecture.

**Vérification** : `getParcel(id)` puis comparaison **champ par champ** avec le patch demandé. On ne fait jamais confiance au seul code retour.

---

## 6. Algorithme du worker live

Séquentiel, jamais parallèle sur un même tenant (le commentaire du worker actuel le prévoit déjà : « future live adapter must opt in explicitly rather than inherit parallelism »).

```
si AUTO_FIX_PAUSED ≠ 'false' → sortir
si SYNC_PAUSED = 'true'      → sortir
pour chaque tenant en mode 'live' (borné) :
  jobs = claim_auto_fix_jobs(tenant, limite, mode='live')
  pour chaque job, EN SÉRIE :
    si job.state == 'applied' :        # reprise après crash
        vérifier ; ne PAS ré-écrire
        continuer
    si pattern non armé              → pending_manual
    si source_kind = integration     → pending_manual
    si colis déjà annoncé            → pending_manual
    plan  → plan_auto_fix_live
    PUT   → mark_auto_fix_applied     # persisté AVANT la vérification
    GET   → verify_auto_fix_live
```

**Bornes :** un lot par run et par tenant (défaut 5, plafond dur 10, aligné sur `auto_fix_max_candidates`), pas de boucle non plafonnée. Chaque job est isolé : un échec n'interrompt pas les suivants.

---

## 7. Armement pattern par pattern

Un drapeau par pattern, **fermé par défaut**, pour armer `address_too_long` seul, l'observer, puis `currency_chf`. Le drapeau est lu côté serveur ; un pattern non armé produit `pending_manual`, jamais une écriture.

Ordre d'activation : un tenant en `live` + un seul pattern armé + un lot de 5 → observation → élargissement.

---

## 8. Sécurité

- `/api/auto-fix/run` et le worker : **`CRON_SECRET` uniquement**, jamais une session utilisateur.
- `status` / `retry` / `resolve` : `requireRole(['super_admin','admin','ops'])` + filtrage `tenant_id` explicite.
- Bascule d'un tenant en `live` : **`super_admin` uniquement**.
- `before_json` / `after_json` contiennent de la PII → redaction et rétention (la RPC `cleanup_auto_fix_pii` existe déjà).

---

## 9. Ce qu'il faut prouver par des tests avant tout déploiement

1. Deux workers concurrents réclament le même job → **un seul** l'obtient (`FOR UPDATE SKIP LOCKED`).
2. Crash entre l'écriture et la vérification → à la reprise, le job **vérifie**, il ne réécrit pas.
3. Timeout après écriture → aucune seconde écriture ; la relecture tranche.
4. Vérification qui contredit le patch → le job ne passe **pas** `verified`.
5. Erreur `non_retryable` → `pending_manual` **immédiatement**, aucun retry.
6. Tenant `simulated` → **aucune** écriture possible, même si un job `live` traîne.
7. `AUTO_FIX_PAUSED` → le worker sort sans rien réclamer.
8. Pattern non armé → `pending_manual`, jamais d'écriture.

---

## 10. Ce que cette conception ne fait délibérément pas

- Pas de `cancel + recreate` : c'est ce qui portait l'essentiel des risques de doublon, de stock et de course webhook.
- Pas d'écriture sur les integration shipments tant que la création liée n'est pas validée.
- Pas de correction du pattern 1002 : c'est un routeur de causes, il mérite son propre lot.
- Aucun contact avec le stock : le moteur ne touche que Sendcloud et ses propres tables. La consommation de stock reste pilotée par le cron et les webhooks, inchangée.
