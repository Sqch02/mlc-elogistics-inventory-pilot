# Spike Sendcloud Phase 2 — rapport de clôture

Date : 21 juillet 2026
Périmètre : étape 0 et validation d'écriture contrôlée sur colis jetable

## Verdict

**GO partiel pour figer le contrat des parcels numériques non annoncés ; NO-GO maintenu pour activer le moteur complet.**

La validation contrôlée du 21 juillet 2026 a levé les deux incertitudes du premier protocole :

1. le compte existant Anteos accepte encore `POST /api/v2/parcels` ;
2. le contrat d'update qui fonctionne est bien `PUT /api/v2/parcels` avec `parcel.id` dans le corps.

Le contrat legacy `PUT /api/v2/parcels/{id}` ne doit donc pas être testé ni conservé dans le futur adapter. Le GO complet reste conditionné à la création liée au `shipment_uuid`, au test Service Points/Mondial Relay et aux validations propres aux transformations métier rares.

Les blocages encore ouverts sont concrets :

1. l'endpoint Service Points a répondu `400 Service point support is not activated for this integration` sur les trois comptes initialement testables avec Mondial Relay ;
2. aucun exemple réel de code douanier manquant, poids trop bas ou erreur API « point relais non sélectionné » n'a été trouvé dans la fenêtre bornée ;
3. la création v2 est confirmée pour Anteos uniquement : la capacité doit rester détectée/configurée par compte, sans généralisation implicite ;
4. la création liée au `shipment_uuid` et son effet sur l'Incoming Order/webshop ne sont pas encore validés ;
5. le webhook transforme actuellement le statut 1002 en réclamation urgente « lost ». Ce conflit doit être corrigé avant toute activation du pattern 1002.

Le transport PUT peut maintenant être implémenté derrière l'adapter et les flags prévus. L'application automatique des patterns reste interdite avant la levée des conditions listées dans « Prochaines validations ».

Le protocole de validation, la recommandation V1 et le harness gated sont détaillés dans
[2026-07-21-sendcloud-write-validation-protocol.md](./2026-07-21-sendcloud-write-validation-protocol.md).

## Résultat de la validation d'écriture contrôlée

Compte : Anteos. Objet : parcel jetable, destinataire fictif, `request_label=false`, item aléatoire non mappable.

| Étape | Résultat observé |
|---|---|
| Création | `POST /api/v2/parcels` réussi, ID numérique `688943595`, statut `999`, `date_announced=null`, aucun tracking et aucune étiquette |
| Contrôle stock | shipment local créé par la sync/webhook, `stock_consumed_at=null`, 0 item mappé, 1 item non mappé |
| Update documenté | `PUT /api/v2/parcels` avec `{parcel:{id, company_name}}` réussi ; GET = valeur modifiée |
| Restauration | même contrat PUT réussi ; GET = valeur initiale restaurée |
| Nettoyage | `POST /api/v2/parcels/688943595/cancel` a répondu HTTP `410` avec `status=deleted` ; GET de réconciliation = objet absent, manifest `rolled_back` |
| État local final | statut `2000 Cancelled`, `stock_consumed_at=null`, toujours 0 item mappé |

Le `410 status=deleted` est un succès terminal pour l'annulation d'un parcel non annoncé, pas une erreur à retenter. Le harness le reconnaît désormais explicitement.

## Ce qui a été observé

La collecte finale a utilisé uniquement des requêtes `GET` sur une fenêtre de 120 jours :

- 4 comptes Sendcloud ;
- 8 intégrations ;
- 702 integration shipments récents ;
- 391 colis numériques en statut 1002 ;
- 0 lecture de la table volumineuse `shipments` ;
- 0 écriture Supabase ;
- 0 écriture Sendcloud ;
- 0 erreur de lecture des comptes.

Les exemples réduits et anonymisés sont dans [2026-07-21-sendcloud-anonymized-samples.json](./2026-07-21-sendcloud-anonymized-samples.json).

### Hiérarchie des sources

Deux ressources doivent rester distinctes :

- l'**integration shipment**, identifié par `shipment_uuid`, représente la commande importée du webshop. Il expose les données source et le statut `On Hold`, mais l'exemple CHF réel n'expose ni `errors`, ni `warnings`, ni `checkout_payload_errors` ;
- le **parcel numérique**, identifié par `id`, expose le résultat de l'annonce transporteur. Avec `parcel_status=1002&errors=verbose-carrier`, les causes réelles sont présentes dans `errors`.

La détection ne doit donc pas considérer `On Hold` ou 1002 comme une cause. Elle doit d'abord retrouver l'erreur détaillée du parcel quand il existe, puis utiliser les données de l'integration shipment comme contexte et comme source du `shipment_uuid`.

## Matrice par pattern

| Pattern | Ressource et emplacement observés | Action API candidate | Payload essentiel à préserver/corriger | Réponse, effets et critère de succès | Décision du spike |
|---|---|---|---|---|---|
| Devise CHF | Exemple réel `On Hold` sur integration shipment : `currency=CHF`, sans détail d'erreur. Exemple réel sur parcel numérique 1002 : `errors.non_field_errors` demande explicitement EUR. | Pour un shipment UUID : créer un parcel lié au même `shipment_uuid`. Pour un parcel numérique non annoncé : utiliser le PUT documenté validé ; recréer seulement si un champ métier précis s'avère non modifiable. | Toutes les données du colis, `shipment_uuid`, méthode compatible, `total_order_value_currency=EUR`, total et valeurs d'items convertis de façon cohérente. Ne jamais changer uniquement le code devise. | Réponse avec devise EUR et aucune erreur de devise. Si un label est demandé : statut annoncé exploitable et feedback webshop. | **Transport PUT validé ; conversion CHF et réannonce non validées.** |
| Adresse trop longue | Exemple réel parcel 1002 : `errors.address_add2`, limite de 30 caractères ; `date_announced=null`. | Utiliser le PUT documenté validé sur le parcel numérique non annoncé. Pour un integration shipment sans parcel, créer un parcel lié au UUID. | Payload avec `address`/`address_2` corrigés selon les limites du transporteur, sans perdre numéro, ville, pays, méthode, service point ou items. | Le parcel retourné ne contient plus l'erreur d'adresse et peut être annoncé. | **Transport PUT validé ; correction d'adresse réelle et réannonce à valider sur fixture.** |
| Code douanier manquant | Aucun exemple réel trouvé. La documentation et la structure des integration shipments placent `hs_code` et `origin_country` dans `parcel_items[]`; les erreurs détaillées devraient être dans `parcel.errors`. | Pour un shipment UUID hors UE : création liée. Pour un parcel numérique non annoncé : `PUT` seulement après test. | Tous les items, avec `hs_code` pris de `raw_json.parcel_items` puis `tenant_settings.default_hs_code`, et `origin_country`; conserver quantités, poids et valeurs. | Réponse sans erreur customs et documents douaniers générables. Même UUID et nouvel ID local si création. | **Non confirmé : fixture réelle et écriture de test obligatoires.** |
| Poids trop bas | Aucun exemple réel trouvé. Les poids existent dans `parcel_items[].weight` et sur le parcel ; l'erreur détaillée devrait être dans `parcel.errors`. | Même décision `PUT` versus création liée, à établir sur un colis de test. | Poids total et poids des items cohérents ; appliquer la valeur minimale déterminée par le message ou la méthode, pas une constante aveugle. Préserver tous les autres champs. | Réponse sans erreur de poids, total compatible avec la somme `item.weight × quantity`, même UUID. | **Non confirmé : fixture réelle et écriture de test obligatoires.** |
| Announcement failed 1002 | Exemples réels sur parcels numériques. Les causes observées incluent CHF, adresse trop longue et EORI expéditeur manquant. `status.id=1002` seul ne décrit pas la cause. | Ne jamais corriger 1002 seul. Si `errors` correspond sans ambiguïté à 1–4 ou 6, appliquer le correctif de cette cause. Sinon : retry borné après backoff pour les erreurs transitoires, puis manuel ; aucun cancel automatique. | Dépend exclusivement de la cause reconnue. Toujours conserver `shipment_uuid`, méthode et intégrité métier. | Succès = disparition de la cause et statut annoncé exploitable, pas seulement disparition de 1002. Un 1002 inconnu reste manuel. | **1002 n'est pas auto-corrigeable seul.** |
| Point relais non sélectionné | Un integration shipment `shipping_method_checkout_name` point relais avec `to_service_point=null` a été trouvé, mais il était `Completed` et sans erreur : heuristique seulement. Les trois sondes Mondial Relay ont retourné HTTP 400 car Service Points n'est pas activé sur l'intégration API. | Après activation/configuration : `GET service-points` avec le carrier exact et rayons bornés, vérifier la méthode via `shipping_methods?service_point_id=…`, puis créer le parcel lié au UUID avec le point et la méthode compatibles. Ne jamais substituer le transporteur. | Adresse de recherche, `carrier=mondial_relay`, rayon 5/10/25 km, point `is_active` et ouvert, `to_service_point`, `shipment.id`, `shipment_uuid`, payload complet. | Réponse avec un ID numérique, le même UUID, le point choisi et une méthode compatible ; feedback webshop. Si zéro point, 400, timeout ou incompatibilité : retry borné puis `pending_manual`. | **NO-GO tant que Service Points n'est pas activé et testé.** |

## Conclusion spécifique au statut 1002

Le statut 1002 est un **résultat d'annonce**, pas un pattern de correction autonome. La preuve la plus nette est un colis 1002 dont la cause réelle est l'absence d'EORI expéditeur, hors des six transformations prévues.

Règle recommandée :

1. récupérer le parcel numérique avec `errors=verbose-carrier` ;
2. classer une cause déterministe ;
3. n'autoriser une correction automatique que pour une cause connue et un payload complet ;
4. traiter les erreurs temporaires par retry borné et backoff ;
5. placer tout le reste en manuel sans cancel/recreate.

Un cancel+recreate générique sur tout statut 1002 serait dangereux : il pourrait dupliquer une commande, perdre le lien webshop, masquer une configuration transporteur/EORI ou déclencher le bug webhook actuel.

## Écarts du client Sendcloud actuel à traiter après le GO

Ces écarts ne sont pas corrigés dans le spike :

- `CreateParcelData` ne porte pas `shipment_uuid`, `total_order_value_currency`, `total_order_value`, `to_service_point`, ni `hs_code`/`origin_country` sur les items ;
- `UpdateParcelData` ne porte pas les champs devise, service point ou douane nécessaires ;
- la forme et l'URL de `updateParcel` doivent être alignées avec le contrat API réellement validé ;
- `parseIntegrationShipment` force `has_error=false` et perd la distinction `errors`/`warnings`/`checkout_payload_errors` dans les colonnes normalisées ; le moteur devra lire le JSON source ou un parseur de détection séparé ;
- une création liée doit être retrouvable par `shipment_uuid` avant tout nouveau POST, et l'ID numérique retourné doit remplacer durablement le `sendcloud_id` local ;
- le remplacement doit conserver le même shipment local et le même `stock_consumed_at` afin de ne jamais reconsommer le stock ;
- l'endpoint v2 de création est en maintenance : confirmer l'éligibilité des comptes existants ou décider explicitement le passage à v3.

## Prochaines validations avant GO complet

Validation explicite de Maxime requise avant toute écriture :

1. activer Service Points et Mondial Relay sur l'intégration retenue, puis refaire les sondes 5/10/25 km ;
2. créer des fixtures de test pour CHF, adresse, HS, poids et point relais manquant ;
3. tester le flux de création liée au `shipment_uuid`, son effet webshop et l'absence de doublon ;
4. vérifier sur les fixtures que chaque champ métier nécessaire est réellement accepté par le PUT validé ;
5. détecter/configurer la capacité v2 par compte et conserver le plan B v3 pour les comptes non éligibles ;
6. corriger le mapping webhook `1002 → lost` avant l'activation du pattern ;
7. seulement après ces preuves, activer progressivement les stratégies d'application concernées.

## Outil d'investigation

Le script local [sendcloud-readonly-spike.ts](../../scripts/sendcloud-readonly-spike.ts) n'est pas une route déployée. Il :

- n'autorise que `GET` vers `panel.sendcloud.sc` et `servicepoints.sendcloud.sc` ;
- borne la fenêtre, les intégrations, les pages, la taille des pages et les exemples ;
- lit éventuellement `tenant_settings` uniquement pour charger les credentials, sans interroger `shipments` ;
- anonymise identifiants, coordonnées, références, SKU, propriétés personnalisées, documents et données douanières ;
- utilise un sel aléatoire par exécution et n'affiche aucun credential ;
- sonde au plus une fois Mondial Relay par compte, sur 5 km, uniquement avec l'option explicite.

Exécution bornée :

```bash
node --env-file=.env.local --import tsx scripts/sendcloud-readonly-spike.ts \
  --credentials-source supabase \
  --max-tenants 8 \
  --lookback-days 120 \
  --max-integrations 8 \
  --max-pages-per-integration 3 \
  --max-parcel-pages 10 \
  --page-size 100 \
  --samples-per-pattern 1 \
  --probe-service-points true
```

## Documentation de référence

- [Integration shipments — Retrieve a list of shipments](https://sendcloud.dev/api/v2/integrations/retrieve-a-list-of-shipments)
- [Fulfill orders et lien par shipment_uuid](https://sendcloud.dev/docs/shipments/fulfill-orders)
- [Parcels — Retrieve parcels](https://sendcloud.dev/api/v2/parcels/retrieve-parcels)
- [Parcels — Create a parcel](https://sendcloud.dev/api/v2/parcels/create-a-parcel-or-parcels)
- [Parcels — Update a parcel](https://sendcloud.dev/api/v2/parcels/update-a-parcel)
- [Service Points — Retrieve a list](https://sendcloud.dev/api/v2/service-points/retrieve-a-list-of-service-points)
- [Service Points — Create a parcel with service point delivery](https://sendcloud.dev/docs/service-points/creating-a-parcel-with-service-point-delivery)
- [Shipment announcement et gestion des erreurs](https://sendcloud.dev/docs/shipments/create-a-shipment)
- [Sendcloud Help — Announcement failed](https://support.sendcloud.com/hc/en-us/articles/44974401227537-Why-can-t-I-create-a-shipping-label)
