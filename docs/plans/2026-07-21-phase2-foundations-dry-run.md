# Phase 2 — fondations et détection en dry-run

Statut au 21/07/2026 : **prêt pour revue de code, non déployé, migration non appliquée**.
Ce lot ne contient aucun adaptateur d'écriture Sendcloud, aucune mutation de stock,
aucune alerte et aucun email.

## Décisions d'architecture

### Une file d'état courant et un audit séparé

- `auto_fix_jobs` porte l'état courant et la clé d'idempotence.
- `auto_fixes` est l'audit append-only. Ses références `job_id` et `shipment_id`
  utilisent `ON DELETE SET NULL`; la référence tenant est `ON DELETE RESTRICT`.
  Une déduplication de `shipments` ne peut donc pas effacer l'historique.
- Un job représente un **snapshot source avec toutes ses causes ordonnées**, et non
  une cause isolée. Deux patterns ne peuvent ainsi pas modifier concurremment le
  même colis dans la future phase live.

États représentés :

```text
queued -> claimed -> planned -> simulated
             |          |
             +----------+-> retry_wait -> claimed
                            (3 échecs de simulation) -> permanent_failed

États réservés au futur live :
planned -> applied -> verified
        -> pending_manual -> manual_resolved
```

Le claim est une RPC transactionnelle : sélection par `FOR UPDATE SKIP LOCKED`,
puis passage à `claimed` et pose du lease avant de retourner les lignes. Les jobs
`claimed/planned` dont le lease expire sont récupérables.

### Idempotence

`operation_key` est le SHA-256 stable de : version, tenant, type de source, ID
Sendcloud source, fingerprint de l'erreur et du payload utile, liste ordonnée des
patterns, **mode**.

Le mode dans la clé est intentionnel : un audit `simulated` ne pourra jamais
empêcher une future opération `live`. Une modification de l'erreur ou des données
utiles change le fingerprint et crée une nouvelle opération. Une observation
strictement identique ne fait que mettre à jour `last_seen_at`.

`attempt_count` est réservé au live. Le dry-run utilise
`simulation_failure_count`; une simulation réussie écrit l'audit `simulated` sans
consommer de tentative.

### Classification des causes

Les détecteurs lisent exclusivement les collections bloquantes structurées
`errors` et `checkout_payload_errors`.

| Signal | Décision |
|---|---|
| `On Hold` seul | aucun job |
| `warnings` seules | aucun job |
| statut `1002` seul | aucun job |
| `1002` + cause structurée | job du vrai pattern ; `1002` reste un contexte |
| cause structurée inconnue | pattern `unknown`, plan manuel simulé |
| EORI expéditeur | configuration compte, jamais auto-corrigée |

Priorité déterministe : EORI, CHF, adresse, douane, poids, point relais, inconnu.
Le plan adresse ne garde que les champs, longueurs et limites. La douane ne garde
que la présence des defaults tenant, jamais leur valeur. Les messages d'erreur et
références de commande sont hashés.

Limites fonctionnelles assumées pour cette revue :

- CHF : le planner exige encore la définition du taux figé, de sa date et des
  arrondis avant tout live.
- HS code et poids : détecteurs/fixtures disponibles, écriture à laisser coupée
  jusqu'au premier cas réel.
- Point relais : détecteur disponible, résolution bloquée jusqu'à validation
  Service Points + Mondial Relay.
- EORI : plan `account_configuration` / `pending_manual`; l'alerte dédupliquée
  viendra avec le lot alertes.
- Le conflit du webhook `1002 -> réclamation lost` reste hors de ce lot et doit
  être corrigé avant une activation live liée à 1002.

## Ingestion et charge

`fetchParcels` et la réconciliation demandent désormais
`errors=verbose-carrier`. Les integration shipments conservent leurs collections
structurées existantes.

Pendant la sync :

1. détection uniquement dans le lot Sendcloud déjà borné en mémoire ;
2. sélection de 50 candidats maximum par défaut (plafond dur 100) ;
3. une résolution bornée des IDs locaux via l'index unique
   `(tenant_id, sendcloud_id)` ;
4. une RPC d'enqueue idempotente, limitée à 250 côté base.

Il n'y a ni scan/backfill de `shipments`, ni nouvel appel Sendcloud, ni lancement
du worker à la fin du cron. Toute erreur de queue est isolée et ne fait pas échouer
la sync ou le traitement stock existant.

Si le plafond d'enqueue est atteint, `truncated=true` est journalisé et conservé
dans `sync_runs.stats_json.auto_fix_detection`. Les éléments au-delà du plafond ne
sont pas considérés comme couverts : ils devront être repris par le futur backfill
borné et paginé par clé avant toute activation live.

Le worker séparé `POST /api/auto-fix/run` traite séquentiellement 1 à 10 jobs par
tenant selon `tenant_settings.auto_fix_max_candidates`, avec un budget global de
20 s par défaut (45 s maximum). Il ne possède aucun paramètre live et n'importe
pas le client Sendcloud.

## Sécurité, flags et PII

Priorité effective :

1. `AUTO_FIX_PAUSED` : absent, malformé ou différent de `false` = arrêt global ;
2. `AUTO_FIX_DRY_RUN_ENABLED` doit être exactement `true` ;
3. tenant `off` = rien ;
4. tenant `simulated` = queue + worker ;
5. tenant `live` = ignoré explicitement par ce lot.

La route worker exige `CRON_SECRET`. Le service role n'est créé qu'après cette
autorisation. Les RPC et écritures de tables sont révoquées à `anon` et
`authenticated`; ces rôles n'ont qu'un `SELECT` sous RLS tenant/super-admin.

Les JSON potentiellement sensibles expirent à 30 jours. À chaque worker activé,
une RPC purge au maximum 250 lignes par table en s'appuyant sur des index partiels.
Les hashes, patterns, statuts et timestamps non sensibles restent disponibles pour
l'audit.

## Ordre de déploiement futur (pas exécuté dans ce lot)

1. relire et appliquer `00093` pendant une fenêtre contrôlée ; les nouveaux index
   portent uniquement sur des tables neuves et vides ;
2. déployer le code avec `AUTO_FIX_PAUSED=true`,
   `AUTO_FIX_DRY_RUN_ENABLED=false` et tous les tenants `off` ;
3. vérifier la sync et les métriques I/O ;
4. autoriser le dry-run global, puis passer un seul petit tenant à `simulated` ;
5. appeler le worker par un cron distinct et décalé ;
6. revoir les audits simulés avant toute conception de l'adaptateur live.

Ce document ne constitue pas une autorisation de déploiement ou d'activation.
