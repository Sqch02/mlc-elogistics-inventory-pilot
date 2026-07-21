# Protocole de validation des écritures Sendcloud

Date : 21 juillet 2026

Statut : **première validation exécutée et rollbackée sur Anteos**. Les validations suivantes restent soumises à un accord explicite de Maxime après génération et lecture du manifest correspondant.

Mode opératoire simplifié : [`2026-07-21-sendcloud-first-write-runbook.md`](./2026-07-21-sendcloud-first-write-runbook.md).

Résultat observé : création v2 disponible, contrat documenté `PUT /api/v2/parcels` confirmé, valeur restaurée et parcel non annoncé supprimé. L'annulation a retourné `410 {"status":"deleted"}`, confirmé ensuite en GET ; ce résultat est terminal et ne doit pas être retenté.

## Avis et décision d'architecture

La question « PUT ou création liée » ne doit pas être tranchée par une préférence globale :

- si la cible est déjà un **parcel numérique non annoncé**, la voie normale doit être un `PUT` en place ; elle conserve l'identité du parcel et réduit fortement les risques de doublon, de webhook et de stock ;
- si la cible n'existe que comme **integration shipment avec `shipment_uuid`**, il n'y a pas de parcel à mettre à jour : il faut créer un parcel lié à ce UUID ;
- `cancel+recreate` ne doit être ajouté au moteur que si un test démontre qu'un champ nécessaire n'est ni modifiable par `PUT`, ni traitable par création liée. Ce n'est pas une stratégie par défaut ;
- si la création v2 est indisponible, le plan B qui préserve le mieux le lien métier est **Orders API v3 : `PATCH /orders/{id}` puis Ship an Order**, pas un `POST /shipments` générique.

Conséquence importante : la machine complexe de remplacement/cancel/recreate peut probablement être différée. Il ne faut pas la construire avant d'avoir prouvé qu'elle est nécessaire.

## Contrats à valider

| Cas | Contrat documenté à essayer en premier | Contrat alternatif | Décision attendue |
|---|---|---|---|
| Modifier un parcel v2 non annoncé | `PUT /api/v2/parcels` avec `{ "parcel": { "id": 123, ...patch } }` | `PUT /api/v2/parcels/{id}` avec `{ "parcel": { ...patch } }`, seulement après échec prouvé et cible inchangée | Conserver uniquement le contrat qui réussit, puis corriger `client.ts` |
| Créer depuis un integration shipment | `POST /api/v2/parcels` avec payload complet, `shipment_uuid` et d'abord `request_label=false` | Aucun fallback automatique dans la même exécution | Confirmer ID numérique retourné, UUID conservé et absence de doublon |
| Corriger une Order v3 | `PATCH /api/v3/orders/{id}` avec seulement les champs modifiés | Upsert `POST /api/v3/orders` seulement si PATCH ne couvre pas les items nécessaires | Vérifier l'Order, puis restaurer le snapshot |
| Expédier une Order v3 | `POST /api/v3/orders/create-label-sync` | Endpoint asynchrone uniquement pour la production en volume | Confirmer `shipment_id`, `parcel_id`, lien avec l'Order et annulation |
| Annuler v3 | `POST /api/v3/shipments/{shipment_id}/cancel` | Vérification/polling si réponse asynchrone | Statut `CANCELLED` confirmé |

La documentation v2 met aujourd'hui la création de parcels en maintenance et la ferme aux nouveaux comptes. La date de création déclarative du compte n'est pas une preuve suffisante : l'accès doit être confirmé par un POST contrôlé. Un timeout ou une réponse réseau ambiguë ne doit **jamais** déclencher un fallback automatique v3, car le POST v2 peut avoir créé l'objet malgré l'absence de réponse.

## Préconditions non négociables

Chaque cible doit respecter toutes les conditions suivantes :

1. un seul petit compte client existant, choisi explicitement par Maxime (ANTEOS ou Motijet), avec credentials placés uniquement dans `SENDCLOUD_TEST_API_KEY` et `SENDCLOUD_TEST_SECRET` ;
2. référence, numéro de commande ou `order_id` commençant par `MLC-AUTOFIX-TEST-` ;
3. destinataire fictif `MLC AUTOFIX TEST`, sans email ni téléphone, jamais une vraie commande client ;
4. aucune expédition de stock réelle : `request_label=false`, aucune étiquette et des `parcel_items` portant des SKU/descriptions aléatoires `MLC-AUTOFIX-NO-SKU-*` qui ne peuvent pas être mappés ;
5. aucune écriture dans la base de production par le harness ; si le cron voit le parcel, il ne peut enregistrer qu'un item non mappé et ne consomme aucun stock (`mappedCount=0`) ;
6. une seule cible jetable et une seule requête d'écriture en cours à la fois ; les manifests successifs conservent séparément les preuves de création, PUT, restauration et annulation ;
7. snapshot GET immédiatement avant chaque écriture ; si le hash a changé, le harness refuse ;
8. aucun retry automatique d'un POST/PUT/PATCH ; une issue réseau incertaine produit `outcome_unknown` et impose une réconciliation en lecture seule ;
9. premier test de création v2 avec `request_label=false` ; aucune étiquette transporteur réelle dans cette étape ;
10. validation de l'annulation du transporteur avant tout essai avec une vraie méthode payante.

Même avec ces précautions, le feedback vers Shopify n'est pas parfaitement « rollbackable ». L'annulation Sendcloud ne garantit pas que tous les statuts déjà renvoyés au webshop seront restaurés. C'est pourquoi la commande doit appartenir à une boutique et un client de test.

## Séquence recommandée

### Phase A — caractérisation en lecture seule

1. Identifier l'empreinte du compte de test.
2. Lire séparément le parcel v2, l'integration shipment v2 et l'Order v3.
3. Vérifier qu'une seule Order v3 correspond à `integration_id + order_id/order_number`.
4. Relancer la sonde Service Points après activation et confirmer que `mondial_relay` retourne des points actifs sur 5 km ; ensuite seulement essayer 10 puis 25 km si nécessaire.
5. Vérifier dans le panel et dans la boutique test que la commande n'est ni expédiée, ni facturée, ni consommée en stock.

Cette phase peut être exécutée sans le flag d'écriture.

### Phase B — confirmer la création v2 et trancher le contrat PUT

Créer d'abord un parcel autonome jetable via `POST /api/v2/parcels`, sans `shipment_uuid`, avec `request_label=false`, un destinataire fictif et un `order_number` unique. Cette requête confirme directement l'accès à la création v2. Elle est réconciliable par le marqueur exact et son rollback est `POST /api/v2/parcels/{id}/cancel`, qui supprime un parcel non annoncé.

Le parcel numérique retourné devient ensuite l'unique cible du test PUT. Le test ne porte que sur `company_name`, de `MLC TEST AVANT PUT` vers `MLC TEST APRES PUT`, afin d'utiliser un champ explicitement montré dans le contrat officiel et de rendre le diff parfaitement réversible.

Le parcel doit avoir :

- `date_announced=null` ;
- aucun tracking ;
- statut « No label » ou 1002 ;
- marqueur `MLC-AUTOFIX-TEST-…` ;
- un champ réversible, par exemple `address_2`, avec une valeur initiale et une valeur test toutes deux valides.

Ordre strict :

1. préparer le manifest `documented` ;
2. après accord explicite, exécuter **une seule fois** `PUT /api/v2/parcels` avec `parcel.id` ;
3. faire un GET et vérifier la valeur ;
4. rollback avec la valeur exacte du snapshot, puis GET de confirmation ;
5. si et seulement si le PUT documenté retourne un échec non ambigu et que le GET prouve une cible inchangée, préparer un **nouveau manifest** `legacy` ;
6. demander un nouvel accord avant d'essayer `/parcels/{id}`.

Si le contrat documenté fonctionne, le legacy ne doit pas être essayé « pour voir ».

Après ce test de transport, un deuxième parcel test portant une vraie erreur synthétique permettra de vérifier le champ métier exact. La demande de label/annonce est une étape séparée, avec une nouvelle validation, car elle peut déclencher facturation, webhook et feedback Shopify.

### Phase C — confirmer plus tard la création liée au UUID

Sur un integration shipment `On Hold` strictement de test :

1. construire un payload complet à partir du snapshot, corriger uniquement le champ ciblé ;
2. imposer `shipment_uuid` identique, `order_number` identique et `request_label=false` ;
3. exécuter un seul `POST /api/v2/parcels` ;
4. vérifier le nouvel ID numérique, le même UUID et l'absence de doublon ;
5. annuler le parcel non annoncé : Sendcloud doit le supprimer ou le marquer annulé ;
6. vérifier manuellement l'état de l'Incoming Order et de la boutique test.

Interprétation de l'accès v2 :

- `2xx` avec parcel retourné : compte éligible v2 ;
- `403/404/410` explicite de maintenance/accès, puis recherche confirmant zéro création : basculer vers le protocole v3 ;
- timeout/5xx/réponse ambiguë : **stop**, recherche par `shipment_uuid` et `order_number`, aucun fallback ni nouveau POST.

### Phase D — valider le plan B v3

Cette phase peut être faite même si v2 fonctionne, mais elle n'est pas nécessaire au chemin critique V1.

1. GET de l'Order v3, exactement une correspondance et statut `unshipped/on_hold`.
2. `PATCH /api/v3/orders/{id}` sur un champ réversible ; GET ; rollback ; GET.
3. Nouveau manifest Ship an Order, avec `apply_shipping_rules=false` et l'option de test `sendcloud:letter`.
4. `POST /api/v3/orders/create-label-sync` ; vérifier `shipment_id` et `parcel_id`.
5. `POST /api/v3/shipments/{shipment_id}/cancel` ; vérifier `CANCELLED`. Si annulation asynchrone, le manifest reste `rollback_pending` jusqu'à confirmation.

Pour les corrections réelles, le flux v3 serait : PATCH de l'Order, vérification, Ship an Order. Il crée une fenêtre de course avec une resynchronisation Shopify ; il faudra donc verrouiller cette Order et effectuer les deux opérations de façon rapprochée, sans retry aveugle.

## Harness local et verrous

Fichier : [`scripts/sendcloud-write-validation.ts`](../../scripts/sendcloud-write-validation.ts)

Le harness :

- refuse les credentials génériques `SENDCLOUD_API_KEY` ;
- refuse toute écriture si `NODE_ENV=production` ou si un environnement Render est détecté ;
- limite les URLs à `panel.sendcloud.sc/api/v2|v3` ;
- impose un marqueur de commande de test ;
- refuse un PUT sur un parcel annoncé ou avec tracking ;
- limite les champs modifiables par opération ;
- crée un manifest local mode `0600`, ignoré par Git, avec snapshot et rollback ;
- exige un compte dont l'empreinte correspond au manifest ;
- exige `SENDCLOUD_WRITE_VALIDATION_ENABLED=true` ;
- exige la phrase `I_UNDERSTAND_ONE_TEST_OBJECT` ;
- exige le token propre au manifest et à l'opération ;
- prend un verrou local global et refuse une deuxième validation concurrente ;
- refuse de préparer ou d'exécuter un second colis jetable tant que le premier n'est pas annulé, réconcilié ou terminé ;
- expire un plan d'exécution après 24 h, mais n'expire pas le droit de rollback ;
- n'effectue aucun retry d'écriture ;
- fournit une commande de réconciliation GET-only après timeout ou crash, sans autoriser de retry tant que l'issue reste inconnue ;
- refuse le rollback si les champs ont changé depuis l'écriture ;
- sépare l'exécution et le rollback en deux commandes explicites.
- reconnaît comme nettoyage terminal le `410` Sendcloud portant `status=deleted`, en plus du `404` après suppression d'un parcel non annoncé.

### Commandes lecture seule

```bash
export SENDCLOUD_TEST_API_KEY="..."
export SENDCLOUD_TEST_SECRET="..."

node --import tsx scripts/sendcloud-write-validation.ts account-fingerprint

node --import tsx scripts/sendcloud-write-validation.ts inspect-v2-parcel \
  --parcel-id 123456

node --import tsx scripts/sendcloud-write-validation.ts inspect-v2-shipment \
  --integration-id 123 \
  --shipment-uuid 00000000-0000-0000-0000-000000000000

node --import tsx scripts/sendcloud-write-validation.ts inspect-v3-order \
  --order-id 123456
```

Avec les clés dans `.env.local`, la commande simplifiée est :

```bash
npm run sendcloud:write-validation -- account-fingerprint
```

### Préparer le colis jetable sans l'exécuter

```bash
npm run sendcloud:write-validation -- scaffold-v2-disposable \
  --payload-file .sendcloud-write-validation/disposable-payload.json

npm run sendcloud:write-validation -- prepare-v2-create-disposable \
  --payload-file .sendcloud-write-validation/disposable-payload.json \
  --manifest .sendcloud-write-validation/disposable-create-manifest.json
```

La première commande écrit seulement le payload local. La seconde fait une recherche GET bornée sur le `order_number` exact, puis écrit un manifest local. Aucune ne touche Sendcloud ni la base en écriture.

### Préparer un PUT sans l'exécuter

Le patch et le manifest doivent rester sous `.sendcloud-write-validation/` ou dans un autre fichier local ignoré. Ils peuvent contenir de la PII de test.

```bash
node --import tsx scripts/sendcloud-write-validation.ts prepare-v2-update \
  --parcel-id 123456 \
  --contract documented \
  --patch-file .sendcloud-write-validation/put-address-patch.json \
  --manifest .sendcloud-write-validation/put-address-manifest.json
```

Cette commande ne fait qu'un GET et écrit le manifest local. Elle affiche le token à soumettre à Maxime avec le diff exact.

### Exécuter après accord explicite

```bash
export SENDCLOUD_TEST_ACCOUNT_FINGERPRINT="sendcloud-test:..."
export SENDCLOUD_WRITE_VALIDATION_ENABLED=true

node --import tsx scripts/sendcloud-write-validation.ts execute \
  --manifest .sendcloud-write-validation/put-address-manifest.json \
  --allow-write I_UNDERSTAND_ONE_TEST_OBJECT \
  --approval-token "APPROVE:..."
```

### Rollback

Le token de rollback est produit seulement après une écriture vérifiée.

```bash
node --import tsx scripts/sendcloud-write-validation.ts rollback \
  --manifest .sendcloud-write-validation/put-address-manifest.json \
  --allow-rollback I_UNDERSTAND_ONE_TEST_OBJECT \
  --approval-token "ROLLBACK:..."
```

Si l'annulation transporteur est asynchrone :

```bash
node --import tsx scripts/sendcloud-write-validation.ts verify-rollback \
  --manifest .sendcloud-write-validation/ship-order-manifest.json
```

Après un timeout, un crash ou un état `outcome_unknown`, ne jamais relancer le write. Réconcilier d'abord :

```bash
node --import tsx scripts/sendcloud-write-validation.ts reconcile \
  --manifest .sendcloud-write-validation/operation-manifest.json
```

Pour une création, zéro résultat laisse volontairement l'état `outcome_unknown` à cause de la cohérence éventuelle ; plusieurs résultats imposent une vérification manuelle.

## Recommandation de périmètre V1

### À livrer et activer progressivement

1. **Adresse trop longue** : vraie erreur observée, transformation déterministe. Première candidate live après validation PUT.
2. **CHF** : vraie erreur observée, mais convertir les montants est plus risqué qu'un simple changement de devise. Live uniquement avec une source de taux figée, arrondi documenté et contrôle somme des items/total.
3. **Routeur 1002** : indispensable, mais 1002 n'est pas un « fix ». Il classe la cause puis délègue à un pattern connu ; sinon retry transitoire ou manuel.

### À construire en dry-run/capacité contrôlée

4. **Point relais** : le devis le demande et la valeur métier est réelle. Construire le resolver, le mapping exact du carrier et le fallback manuel, mais garder l'application live derrière un flag propre au pattern jusqu'au test Mondial Relay complet. L'absence de point n'est pas prouvée comme erreur réelle dans l'échantillon.
5. **HS code manquant** : construire le détecteur et le planner pur avec fixtures synthétiques, lire `raw_json.parcel_items` puis le défaut tenant, mais laisser le write désactivé jusqu'au premier exemple réel. Ne pas investir dans Shopify pour V1.
6. **Poids trop bas** : même approche capacité-only. Le seuil doit provenir de l'erreur/méthode, pas d'une constante globale. Activation après un cas réel ou une fixture Sendcloud contrôlée.

Cette approche honore le périmètre fonctionnel sans faire semblant d'avoir validé des comportements jamais observés. Elle évite aussi que les patterns rares dictent toute l'architecture du chemin critique.

## EORI expéditeur manquant

Recommandation : **ne pas l'ajouter comme auto-fix de commande**.

L'EORI est une configuration légale de l'expéditeur et peut dépendre de l'entité, du sender address, du contrat et du pays. Le déduire ou le recopier automatiquement serait risqué et pourrait expédier sous une identité douanière incorrecte.

Il faut toutefois reconnaître ce cas dans le routeur 1002 comme un **blocage de configuration tenant** :

- une seule alerte dédupliquée par tenant + sender address + transporteur ;
- suspension des nouvelles tentatives pour les commandes touchées ;
- message opérationnel indiquant où configurer l'EORI dans Sendcloud ;
- bouton/résolution manuelle après correction ;
- nouvelle vérification en lecture seule avant remise en file.

Cela évite cinquante alertes de commande pour un seul défaut de compte.

## Risques et angles morts

1. **Webhooks pendant le test** : le mapping actuel `1002 → lost` et les réapprovisionnements sur cancel rendent dangereux tout test lié au stock réel.
2. **Shopify n'est pas transactionnel avec Sendcloud** : un rollback Sendcloud ne restaure pas nécessairement le statut Shopify.
3. **Fallback inter-API après timeout** : interdit. Un POST v2 peut avoir réussi avant le timeout ; tenter v3 créerait un doublon.
4. **Resynchronisation Shopify pendant PATCH v3** : elle peut écraser la correction avant Ship an Order.
5. **Création v2 maintenance** : même si elle fonctionne aujourd'hui, encapsuler l'accès derrière un adapter par tenant/intégration, sans supposer que tous les comptes ont la même capacité.
6. **Idempotence externe** : v3 Shipments offre `external_reference_id` unique, mais Ship an Order n'offre pas la même garantie apparente. La recherche préalable par Order et la clé d'opération locale restent nécessaires.
7. **Conversion CHF** : taux, date du taux, arrondis, total de commande, valeurs unitaires et éventuels frais doivent rester cohérents.
8. **Service point** : `is_active` mesure la fraîcheur des données ; vérifier aussi l'ouverture prochaine et la méthode compatible. Ne jamais substituer un carrier.
9. **Cancel non garanti** : certains transporteurs refusent ou traitent l'annulation de façon asynchrone. Aucun test payant sans confirmation préalable du transporteur.
10. **Le test peut simplifier le plan** : si PUT + création liée couvrent tous les cas, différer complètement cancel+recreate et sa relation de remplacement/stock.

## Ce dont j'ai précisément besoin de Maxime

Idéalement deux commandes de test, utilisées séquentiellement :

### Cible A — validation PUT

- ID numérique du parcel ;
- statut « No label » ou 1002, `date_announced=null`, aucun tracking ;
- `order_number` ou `reference` préfixé `MLC-AUTOFIX-TEST-` ;
- champ à modifier et valeurs avant/après attendues ;
- confirmation qu'il n'existe aucune consommation de stock, facture ou client réel ;
- confirmation que webhook/sync de production ne produiront aucun effet métier sur cet ID.

### Cible B — validation création liée

- `integration_id` Sendcloud ;
- `shipment_uuid` d'une commande `On Hold` de test sans parcel exploitable ;
- `order_id`, `order_number` et ID interne Order v3 si visible ;
- données complètes de test : destinataire contrôlé, adresse, pays, poids, items, valeur/devise, méthode de livraison ;
- si point relais : code carrier exact `mondial_relay`, ID de méthode compatible et point relais de test ;
- confirmation Service Points + Mondial Relay activés sur l'intégration API de test ;
- accès à la boutique test pour vérifier le feedback après l'essai.

### Accès et autorisation

- placer les credentials dans les variables `SENDCLOUD_TEST_*` localement, ne pas les envoyer dans le rapport ou le commit ;
- me transmettre seulement l'empreinte produite par `account-fingerprint` ;
- préciser si l'intégration et le tenant sont totalement isolés ou quelles protections webhook/sync sont en place ;
- après préparation, valider explicitement l'opération, la cible, le diff et le token affiché. Un accord est demandé pour chaque write et pour chaque changement de contrat.

## Références Sendcloud

- [Update a parcel v2](https://sendcloud.dev/api/v2/parcels/update-a-parcel)
- [Create a parcel v2 et maintenance](https://sendcloud.dev/api/v2/parcels/create-a-parcel-or-parcels)
- [Fulfill orders et lien shipment_uuid](https://sendcloud.dev/docs/shipments/fulfill-orders)
- [Update an Order v3](https://sendcloud.dev/api/v3/orders/update-an-order)
- [Ship an Order v3](https://sendcloud.dev/api/v3/ship-an-order/request-a-label-for-a-single-order-synchronously)
- [Cancel a shipment v3](https://sendcloud.dev/api/v3/shipments/cancel-a-shipment)
- [Créer des labels de test](https://sendcloud.dev/docs/getting-started/test-labels/)
- [Service Points](https://sendcloud.dev/api/v2/service-points/retrieve-a-list-of-service-points)
