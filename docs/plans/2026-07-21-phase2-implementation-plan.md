# Phase 2 — Plan d'implémentation v2 (révisé 21/07/2026 après revue technique)

Base : design doc `2026-05-21-auto-fix-sendcloud-errors-design.md` (périmètre fonctionnel).
Cette v2 **remplace la v1** : elle intègre les conclusions de la revue technique (verdict "à ajuster"),
dont chaque point concret a été vérifié dans le repo. Devis signé 1 200 € HT.
**Ne pas démarrer le moteur avant le spike Sendcloud (étape 0).**

## Corrections de la v1 (faits vérifiés dans le repo)
- Les migrations sont **déjà à 00092** → les nouvelles commencent à **00093**.
- **Ne PAS créer `tenant_customs_settings`** : `tenant_settings.default_hs_code` et
  `default_origin_country` existent déjà (migration 00073 l'indique explicitement).
- `cancelParcel` **existe déjà** (`client.ts:759`), inutile de le recréer.
- **Pas de `shopify_api_token`** en base → l'intégration Shopify pour le HS code est un
  sous-projet : **HORS V1**. Pattern 3 = lire le HS depuis `raw_json.parcel_items` puis le
  défaut tenant ; `pending_manual` sinon.
- Les commandes On Hold viennent des **integration shipments** (parseur séparé
  `parseIntegrationShipment`, identifiant `shipment_uuid`, PAS un parcel numérique). Le parseur
  actuel met `has_error=false` → le scan `status_message='On Hold' AND error_message IS NOT NULL`
  ne trouverait rien : à revoir dans le spike + l'ingestion.
- **Aucune colonne `pending_manual`/`manual_resolved`** n'existe → il faut un vrai état courant
  (colonne dédiée ou table de file), pas un filtre sur une colonne inexistante.

## Étape 0 — SPIKE Sendcloud (0,5–1 j, BLOQUANT, avant tout code moteur)
Avec un vrai exemple de CHAQUE pattern, déterminer :
- la ressource source (integration shipment `shipment_uuid` vs parcel numérique) ;
- l'emplacement réel de l'erreur dans le JSON (errors / warnings / checkout_payload_errors) ;
- l'action autorisée par l'API : création liée au `shipment_uuid`, PUT parcel, ou cancel+recreate ;
- le résultat réel côté Sendcloud ET le retour vers Shopify.
Sans ça, l'architecture du moteur n'est pas figée. **Go/no-go sur le reste après ce spike.**

### Critères de sortie du spike (go/no-go documenté)
- **Matrice par pattern** : ressource, exemple anonymisé, erreur exacte, action API, payload, réponse, effet Sendcloud/Shopify, critère de succès.
- **1002** : confirmer s'il est corrigeable seul, ou **seulement** quand une cause 1–4/6 est identifiable.
- **Écritures uniquement sur un tenant/colis de TEST** ; la prod reste en lecture seule tant que non validé explicitement.

Clôture lecture seule du 21/07/2026 : **NO-GO sur les écritures** jusqu'aux validations de test listées dans
[`../spikes/2026-07-21-sendcloud-spike-report.md`](../spikes/2026-07-21-sendcloud-spike-report.md).

## Verrous à formaliser avant le moteur
- **RPC de claim** : `FOR UPDATE SKIP LOCKED` fait l'`UPDATE claimed/locked_until` dans la MÊME transaction, avant de retourner les jobs.
- **États terminaux** de la machine : `simulated`, `retry_wait`, `pending_manual`, `verified`, `manual_resolved`, `permanent_failed`.
- **`operation_key`** défini pour qu'un dry-run ne bloque JAMAIS l'opération live ultérieure.
- **Priorité des flags** (à respecter partout) : `AUTO_FIX_PAUSED` global → tenant off → tenant simulated → tenant live.
- **Rétention PII** : fixer une durée pour les audits `before/after_json` **avant** d'écrire les migrations.
- **Avant le pattern 1002** : persister la relation de **remplacement AVANT le cancel** (le webhook d'annulation ne réapprovisionne pas, le webhook de création ne reconsomme pas) + **tests de course** obligatoires (cancel webhook avant/après recreate, nouveau parcel inséré avant le rattachement local, timeout Sendcloud après création).
- **Outbox** : l'insertion de l'événement est **atomique avec la mutation métier** (facture/arrivage/stock) ; c'est l'échec **ultérieur** de l'envoi SMTP qui ne doit pas annuler cette mutation.

## Décisions post-spike & protocole d'écriture (21/07)
Le **NO-GO écriture tient** jusqu'à validation sur un colis de test (cf `../spikes/2026-07-21-sendcloud-write-validation-protocol.md`).

**Mécanisme d'écriture :**
- Parcel numérique **non annoncé** → **PUT en place** (contrat documenté `PUT /api/v2/parcels` avec `{ parcel: { id, ...patch } }` ; legacy `/parcels/{id}` seulement après échec non ambigu + GET de contrôle).
- Integration shipment avec seulement un `shipment_uuid` → **création liée** (conserve le lien webshop, remplace durablement le `sendcloud_id` local par l'ID numérique retourné).
- **cancel+recreate → HORS V1** : dernier recours seulement si un test prouve qu'un champ n'est pas modifiable autrement. Le sortir élimine l'essentiel des risques doublon/stock/webhook/remplacement d'ID.
- **Accès API** : confirmer la création v2 par un **POST contrôlé `request_label=false`** puis annulation (la date du compte ne suffit pas ; v2 en maintenance). Plan B si v2 indisponible : v3 **`PATCH /orders/{id}` → GET → `POST /orders/create-label-sync`** (garde le lien à l'Order importée). **Jamais de fallback v2→v3 automatique sur timeout.**

**Périmètre V1 par pattern (tiers d'activation de l'écriture) :**
- **Adresse trop longue** → activer en PREMIER (après validation PUT).
- **CHF** → activer, avec **taux figé + date du taux + arrondis + cohérence total/items** (jamais changer seulement la devise).
- **1002** → **routeur de causes** (lire la vraie cause via `errors=verbose-carrier`, appliquer le fix de cette cause) ; jamais correcteur autonome ; inclut le pattern 6.
- **Point relais** → construire resolver + fallback manuel, mais **write derrière un flag** jusqu'à activation Service Points + test Mondial Relay.
- **Code douanier / poids** → détecteur + planner + fixtures synthétiques, **write DÉSACTIVÉ** jusqu'au premier cas réel (aucun exemple sur 120 j).
- **EORI expéditeur manquant** (nouveau, dans les 1002) → **PAS d'auto-fix** (config légale du compte) : **alerte dédupliquée par tenant** + suspension des retries concernés + résolution manuelle + re-vérification.

## Architecture (révisée : découplée du cron)
Leçon du 13/07 (saturation I/O) : **le moteur ne tourne PAS dans le cron de sync**.
- **Pendant la sync** : détecter et **mettre en file** les candidats vus dans le lot courant (aucun appel Sendcloud, aucune écriture lourde).
- **Worker séparé** (cron dédié décalé de quelques minutes, ou endpoint distinct) : traite la file avec plafonds stricts :
  - 5–10 candidats max par tenant et par run ;
  - concurrence Sendcloud 1–2 ; budget temps global ; timeout HTTP ;
  - **gestion explicite des 429** (Sendcloud : 100 écritures/min, 15/s) → remise en file, pas de boucle d'attente ;
  - kill-switch indépendant `AUTO_FIX_PAUSED`.
- **Backfill initial borné et paginé par clé** — jamais un scan récurrent de la table shipments (738 MB).
- Index candidats créé **hors pic, en CONCURRENTLY, avec lock_timeout**, un seul gros index à la fois.

## Idempotence & machine à états (avant toute écriture réelle)
Le compteur `attempts<3` + cooldown 1h ne suffit PAS (crons concurrents, retry manuel pendant un run, crash entre cancel et recreate, timeout après recreate, webhook qui insère le nouveau parcel avant l'update local).
Modèle requis :
- **Réclamation atomique** du travail (`FOR UPDATE SKIP LOCKED` en RPC/transaction).
- **États durables** : `queued → claimed → planned → applied → verified`.
- Champs : `operation_key` unique, hash des données/erreur source, `locked_until`, `next_attempt_at`,
  `original_sendcloud_id` + `result_sendcloud_id`, mode dry_run/live, timestamps `cancelled_at`/`recreated_at`/`linked_at`,
  erreur structurée + catégorie retryable/non-retryable.
- **Ordre durable du cancel/recreate** : enregistrer l'op → cancel → persister le succès du cancel →
  recreate → persister immédiatement le nouvel ID → rattacher atomiquement le shipment local → vérifier le
  nouveau parcel → seulement alors marquer réussi. Après un résultat réseau incertain : **rechercher une création
  existante par `shipment_uuid` avant de refaire un POST**.
- Table d'audit `auto_fixes` : **pas de `ON DELETE CASCADE`** (une dédup de shipments effacerait l'historique).

## Interaction cancel/recreate ↔ stock/webhook (critique)
Le webhook actuel réapprovisionne au cancel et traite un nouveau `sendcloud_id` comme une nouvelle
expédition → **risque de reconsommer le stock** à la recréation (+ courses + fausses alertes stock).
- Le nouveau parcel doit être marqué **remplacement** du précédent : **même shipment local, même
  `stock_consumed_at`**. Webhook ET cron doivent reconnaître cette relation et ne jamais reconsommer.
- **Conflit 1002** : le webhook traite `status_id=1002` comme colis perdu → réclamation urgente
  (`webhook:31`), incompatible avec "Announcement failed 1002" auto-corrigeable. **À clarifier/corriger
  avant activation du pattern 5.**

## Pattern 6 — point relais (spec complétée)
Non trivial. Sendcloud exige : service points activés sur l'intégration, transporteur activé (sinon 400),
service point compatible, méthode d'expédition compatible, `to_service_point` + ID de shipping method à la création.
- **Mapper la méthode checkout → vrai code carrier** (surtout `mondial_relay`), **ne jamais substituer un autre transporteur**.
- Recherche par pays + adresse géocodée, **rayons progressifs bornés** (5/10/25 km).
- Vérifier `is_active`, distance, compatibilité méthode. Auditer le point choisi + distance + alternatives.
- Aucun résultat/incompatibilité → `pending_manual`. 429/timeout/5xx → **retry ultérieur**, pas `pending_manual`.
- **Inclure le pattern 6 dans la redétection du 1002.**

## Dry-run & alertes (précisions)
- Dry-run : écrit un audit `simulated`, **ne consomme pas les tentatives**, ne déclenche **aucune alerte client**.
- Un changement d'erreur/payload = nouveau fingerprint → peut réinitialiser les tentatives.
- Seuil alerte = **5 shipments distincts devenus manuels dans les 6 dernières heures** (pas 5 lignes `auto_fixes`) ;
  le cooldown 6h est un mécanisme séparé.

## Emails & comptes (lot sous-estimé)
Configurer Resend comme SMTP Supabase **ne fournit PAS** un mailer applicatif. Il faut :
- Un **outbox** applicatif : clé d'idempotence par (événement + destinataire), statuts queued/sent/failed,
  retry exponentiel, id fournisseur, **ne pas faire échouer la transaction métier si l'email échoue**.
- Déclencheurs précis : facture à la transition **draft → sent** (pas à chaque génération) ; stock **au
  franchissement du seuil** avec réarmement ; arrivage **un email par group_id** après insertion complète.
- **PDF serveur** : `invoice-pdf.ts` est orienté navigateur (jsPDF + doc.save) → rendre l'export compatible
  serveur pour produire la pièce jointe.
- Setup : domaine vérifié, SPF/DKIM/DMARC, adresses d'expéditeur, **destinataires configurables distincts**
  (facturation / stock / auto-fix / arrivages). Quotas : Resend gratuit 100/j–3000/mois (à confirmer par volume) ;
  Supabase limite par défaut 30 emails Auth/h après config SMTP.

## Sécurité (minimum par endpoint)
- `/api/auto-fix/run` (et le worker) : **CRON_SECRET uniquement**, jamais une session utilisateur.
- status / retry / resolve : `requireRole(['super_admin','admin','ops'])` + **filtrage explicite `tenant_id`**.
- Toggles actif/dry-run + gestion des comptes : **super_admin uniquement**. Service role seulement **après** l'autorisation.
- Reset autonome : réponse générique anti-énumération, rate-limit/CAPTCHA, redirect allowlistée.
- Admin reset : **envoyer un lien de reset/invitation**, ne pas choisir/connaître un mot de passe en clair
  (contrairement au flux actuel `admin/tenants/[id]/users`). Désactivation : agir sur **Supabase Auth** +
  invalider les sessions + auditer (modifier `profiles` seul ne suffit pas).
- `before_json`/`after_json` contiendront de la PII (adresses/emails/téléphones) → **redaction** + rétention.
- `exchange_rates_cache` : **REVOKE anon/authenticated**, écriture réservée au service role.

## Séquencement recommandé
1. Spike Sendcloud sur cas réels + décisions fonctionnelles (étape 0).
2. Modèle jobs/audit/outbox + verrous + index + sécurité.
3. Ingestion correcte des erreurs + détecteurs en dry-run.
4. Dashboard dry-run pour validation opérationnelle.
5. Activation patterns On Hold 1–4 et 6, en petits lots.
6. Pattern 1002 + cancel/recreate, après tests de crash et de courses webhook.
7. SMTP + reset + gestion utilisateurs.
8. Notifications via outbox + PDF serveur.
9. Staging → activation tenant par tenant (Florna en dernier) → observation.

## Estimation réaliste
**9–12 jours** de dev/test si le spike confirme vite le flux ; **12–15 jours** si l'API On Hold ou les
courses stock/webhook demandent une adaptation lourde ; + quelques jours calendaires d'observation progressive.
Livraison **sous 2–3 semaines crédible**, mais **pas** une promesse ferme de "7 jours production-ready".
Le prix (1 200 €) est signé : à ce niveau d'effort, la marge est fine — décision assumée (budget client serré).
Levier d'allègement retenu : **HS code sans intégration Shopify** (hors V1).

Démarrage : à réception de l'acompte + des configs (HS codes, emails, clé SMTP) + **après le spike**.
