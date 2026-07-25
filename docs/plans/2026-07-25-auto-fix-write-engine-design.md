# Moteur d'écriture auto-fix — conception (V2)

**But :** faire passer l'auto-fix de « détecte et simule » à « corrige réellement chez Sendcloud », sans jamais pouvoir écrire deux fois sur un colis.

**Statut :** conception corrigée après revue adversariale. Rien n'est implémenté.

> **Historique.** La V1 de ce document a été soumise à une revue adversariale avant écriture de code. Elle a été rejetée : sa règle de sûreté centrale était inopérante et quatre chemins indépendants menaient à une double écriture. Les corrections sont intégrées ci-dessous, et le §11 conserve la trace de ce qui était faux — pour que personne ne réintroduise ces idées en croyant bien faire.

---

## 1. Ce qui existe déjà (vérifié dans le code, pas supposé)

- `auto_fix_jobs.mode` accepte `'simulated' | 'live'`, et `buildOperationKey` inclut le mode : un job dry-run et un job live sur la même expédition ont des clés différentes. Une simulation ne peut donc pas bloquer l'opération live. ✅
- `auto_fixes.action` accepte déjà `put_update`, `auto_fixes.status` accepte `applied` et `verified`. ✅
- `claim_auto_fix_jobs` réclame de façon atomique (`FOR UPDATE SKIP LOCKED` + `UPDATE` dans une seule instruction). ✅

**Et voici ce qui est faux dans l'existant, et qu'il faut corriger — vérifié ligne par ligne :**

| Constat | Conséquence |
|---|---|
| Le prédicat de réclamation (00093:289-292) couvre `queued`, `retry_wait`, `claimed`, `planned`. **`applied` en est absent.** | Un job qui atteint `applied` n'est **jamais** repris, jamais vérifié, jamais purgé. Orphelin à vie, avec une écriture réelle chez le client jamais contrôlée. |
| La réclamation fait `UPDATE ... SET state='claimed' ... RETURNING j.*`. PostgreSQL renvoie les valeurs **post-update**. | Toute logique du type « si le job revient en état X » est **morte** : l'état vaut toujours `claimed`. |
| `ClaimedAutoFixJob` (types.ts:100-113) **ne porte pas de champ `state`**. | Un test sur `job.state` compare `undefined`. Il passe au vert sans rien vérifier. |
| `auto_fix_jobs_lock_consistency` (00093:95-98) ne tolère `worker_id`/`locked_until` que pour `('claimed','planned')`. | Tout nouvel état d'écriture doit être ajouté à cette contrainte, sinon l'insertion est rejetée. |

---

## 2. Périmètre V1 — inchangé, et confirmé par les données

`address_too_long` en premier, `currency_chf` ensuite. Colis **numériques** uniquement. Pas de `cancel + recreate`. Les patterns `hs_code_missing`, `weight_too_low` restent détecteur seul ; `sender_eori_missing` reste une alerte ; `service_point_missing` reste bloqué chez Sendcloud.

> **Rappel de proportion.** La mesure du 25/07 (`2026-07-25-auto-fix-volume-reel.md`) donne **2 cas `address_too_long` et 0 cas CHF sur 60 jours**. Rien ne justifie de livrer vite. Une conception fausse coûte infiniment plus cher que deux semaines d'attente.

---

## 3. La règle de sûreté — corrigée

**La fenêtre dangereuse n'est pas celle que la V1 protégeait.**

Le danger n'est pas entre l'écriture et la vérification. Il est entre **l'octet envoyé à Sendcloud** et **le commit qui en garde la trace**. Pendant cet intervalle, la base ne sait pas qu'une écriture a été tentée : le job est en `planned`, précisément l'état que le prédicat de reprise ressuscite dès l'expiration du bail.

Et il n'y a même pas besoin d'un crash : si le commit échoue (5xx PostgREST, saturation I/O), le worker route vers un retry, qui replanifie, qui ré-écrit.

**La règle correcte :**

> On persiste **l'intention d'écrire** *avant* l'appel réseau, jamais son résultat après.

```
queued → claimed → planned → applying → applied → verified
                                 │         │
                                 └─────────┴──→ retry_verify → applied_unverified
                                                              (jamais de nouvelle écriture)
```

- Un nouvel état **`applying`** et une colonne **`write_started_at`** sont commités **avant** le PUT, par une RPC dédiée.
- **Règle absolue :** tout job dont `write_started_at IS NOT NULL` part en **vérification seule**, quel que soit son état. Jamais de replanification, jamais de seconde écriture.
- Cette décision se prend sur des **faits durables** (`write_started_at`, `applied_at`, `result_sendcloud_id`) — **jamais sur `state`**, qui est écrasé par la réclamation.

---

## 4. Deux routeurs d'échec, pas un seul

La V1 avait un routeur unique sur `error_category`. C'était sa deuxième faille : un échec **après** écriture y était traité comme un échec **avant** écriture, et repartait en réécriture.

**`fail_auto_fix_live`** — échecs **pré-écriture uniquement**. Garde le backoff exponentiel (5, 10, 20, 40 min, plafond 60), `permanent_failed` au-delà de 3 tentatives. Précondition SQL : `state = 'claimed' AND write_started_at IS NULL`.

**`fail_auto_fix_verification`** — échecs **post-écriture**, appelable uniquement depuis `applying`/`applied`. Route **exclusivement** vers `retry_verify` (relecture seule, 3 essais) puis l'état terminal `applied_unverified` **avec alerte**. Ce routeur ne peut structurellement pas produire une écriture.

**Interdit côté SQL :** toute transition `applying | applied → planned | retry_wait`.

### Reclassification des erreurs

La V1 rangeait les `5xx` avec les `429` en « retryable ». C'est faux pour une écriture : un `502` de passerelle signifie que l'origine **a peut-être appliqué**.

| Réponse | Mutation appliquée ? | Traitement |
|---|---|---|
| `4xx` de validation | Prouvablement **non** | Seul cas autorisant une nouvelle écriture |
| `429` **refusé avant envoi** | Non | Retry d'écriture |
| `5xx`, timeout, erreur réseau | **Incertain** | Entonnoir « relire », jamais réécrire |
| Écart constaté à la vérification | Appliqué, mais pas comme prévu | `pending_manual`, jamais de retry |

---

## 5. Le bail : par job, pas par lot

`claim_auto_fix_jobs` pose **un seul** `locked_until = now() + 120s` pour tout le lot (5, plafond 10). Le traitement étant séquentiel avec un PUT, un GET et trois RPC par job, le dernier job du lot peut attaquer son écriture après expiration du bail. L'écriture a alors lieu **chez le client** pendant que la RPC de traçage la refuse — écriture réelle sans aucune trace.

**Correction :** vérifier et **renouveler le bail juste avant chaque écriture**, par job. Si le bail ne peut pas être renouvelé, on **n'écrit pas** — on relâche le job proprement.

**Et un verrou de single-flight par colis** : deux jobs vivants sur le même `source_sendcloud_id`, ou deux runs concurrents du worker, ne doivent jamais écrire en parallèle.

---

## 6. Reprise : une RPC dédiée, pas une lecture d'état

La V1 testait `job.state === 'applied'` après réclamation. Triplement mort : le champ n'existe pas dans le type, l'état est écrasé par le `RETURNING` post-update, et `applied` n'est pas réclamable.

**Correction :** une RPC **`resume_auto_fix_writes(p_tenant_id, p_worker_id)`** qui :

- sélectionne les jobs `applying`/`applied` **sans changer leur état** ;
- pose un bail dessus ;
- ne rend **que** des jobs à vérifier ;
- n'ouvre **aucun** chemin d'écriture.

Le worker l'appelle **avant** la boucle d'écriture. À compléter : ajouter `applying`/`applied` au `EXISTS` de `get_auto_fix_live_tenants` (sinon le tenant n'est même pas visité) et à `cleanup_auto_fix_pii` (sinon la PII de ces jobs n'expire jamais), plus l'index partiel de reprise.

---

## 7. Écriture Sendcloud

⚠️ Une fonction `updateParcel` existe déjà (`client.ts:812`) mais utilise le chemin **legacy** `/parcels/{id}`, et elle a **un appelant vivant** (la route de modification UI). **On ne la modifie pas.**

Le moteur reçoit sa propre fonction, `patchParcelById(credentials, { id, patch })` :

- `PUT {SENDCLOUD_API_URL}/parcels`, corps `{ parcel: { id, ...patch } }` — le contrat validé sur colis de test (`SENDCLOUD_API_URL` vaut déjà `.../api/v2`).
- `redirect: 'error'`, timeout explicite.
- **Jamais de bascule automatique v2 → v3.**
- Le legacy `/parcels/{id}` reste un repli, jamais un premier choix.

**Vérification :** `getParcel(id)` puis comparaison **champ par champ**, avec normalisation (espaces, casse) pour ne pas confondre une différence de formatage Sendcloud avec un échec.

---

## 8. Fraîcheur de la source

Le patch est calculé au plan, appliqué ensuite. Entre les deux, le colis peut avoir été annoncé, annulé, ou modifié à la main dans Sendcloud.

Le code existant inscrit **déjà** ce garde-fou dans chaque plan : `verify_source_fingerprint_before_future_live_apply`. Il faut l'honorer : **relire le colis juste avant d'écrire**, recalculer le `source_fingerprint`, et abandonner si la source a changé.

---

## 9. Algorithme du worker

```
si AUTO_FIX_PAUSED ≠ 'false' → sortir
si SYNC_PAUSED = 'true'      → sortir

pour chaque tenant en 'live' (borné) :

  # 1. D'ABORD les reprises : aucune écriture possible ici
  pour chaque job de resume_auto_fix_writes(tenant) :
      vérifier par relecture → verified | applied_unverified

  # 2. Ensuite seulement les nouvelles écritures
  pour chaque job de claim_auto_fix_jobs(tenant, mode='live'), EN SÉRIE :
      si pattern non armé / integration / déjà annoncé → pending_manual
      relire la source ; si le fingerprint a changé    → pending_manual
      renouveler le bail ; si impossible               → relâcher
      plan_auto_fix_live
      begin_auto_fix_write            # ← COMMIT AVANT le réseau
      PUT
      mark_auto_fix_applied
      GET → verify_auto_fix_live
```

---

## 10. Ce qu'il faut prouver, en intégration Postgres réelle

Les tests 2 et 3 ne peuvent **pas** être des mocks : mocker `{ state: 'applied' }` fait passer au vert une conception cassée. C'est exactement ce qui aurait masqué les failles de la V1.

1. Deux workers concurrents sur le même job → **un seul** l'obtient.
2. **Mort du process entre le PUT et le commit de traçage** → à la reprise, **zéro seconde écriture**.
3. Job `applied` dont la vérification échoue en `429` → **zéro second PUT**, jamais de retour en `retry_wait`.
4. Bail expiré pendant le PUT → l'écriture est refusée en amont, pas tracée après coup.
5. Vérification qui contredit le patch → le job ne passe **pas** `verified`.
6. `non_retryable` → `pending_manual` immédiatement.
7. Tenant `simulated` → **aucune** écriture possible.
8. `AUTO_FIX_PAUSED` → sortie sans réclamation.
9. Pattern non armé → `pending_manual`.
10. Source modifiée entre le plan et l'écriture → abandon.
11. Un job `applied` **n'est pas orphelin** : il est repris, vérifié, et sa PII expire.

---

## 11. Ce que la V1 affirmait, et qui était faux

Conservé délibérément : ces idées paraissent raisonnables, et c'est ce qui les rend dangereuses.

1. **« Persister `applied` avant la vérification suffit. »** Non : la fenêtre dangereuse est *avant* l'écriture, pas après. « Immédiatement après le retour de l'écriture », c'est quand même après.
2. **« Un job repris en `applied` ne sera pas ré-écrit. »** La garde était morte trois fois : champ absent du type, état écrasé par le `RETURNING`, état non réclamable.
3. **« Un routeur d'échec unique suffit. »** Non : il renvoyait en réécriture un job déjà écrit.
4. **« `5xx` est retryable. »** Non, pas pour une écriture : l'origine a peut-être appliqué.
5. **« Le bail de 120 s couvre le traitement. »** Non : il est pris par lot, pas par job.
6. **« La vérification par relecture protège de tout. »** Elle ne protège de rien si l'échec de vérification peut router vers une nouvelle écriture.

---

## 12. Ce que cette conception ne fait délibérément pas

Pas de `cancel + recreate`. Pas d'écriture sur les integration shipments. Pas de pattern 1002. **Aucun contact avec le stock** : le moteur ne touche que Sendcloud et ses propres tables.
