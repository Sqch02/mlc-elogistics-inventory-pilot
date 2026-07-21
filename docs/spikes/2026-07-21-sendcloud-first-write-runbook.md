# Première validation d’écriture Sendcloud — mode opératoire

Date : 21 juillet 2026

Statut : **prêt à préparer, aucune écriture Sendcloud exécutée**.

Cette étape vérifie uniquement deux points sur un colis jetable :

1. le compte client existant accepte encore `POST /api/v2/parcels` ;
2. un parcel numérique non annoncé accepte le contrat documenté `PUT /api/v2/parcels` avec `parcel.id` dans le corps.

La création liée à un `shipment_uuid`, les Service Points et le moteur d’auto-correction restent hors de cette opération.

## Ce que Maxime doit faire — version ultra-simple

### 1. Choisir le compte

Répondre simplement : **ANTEOS** ou **Motijet**. Ne choisir qu’un seul compte.

### 2. Ouvrir les clés dans Sendcloud

1. Se connecter au compte Sendcloud choisi.
2. Dans le menu de gauche, cliquer sur **Settings** / **Réglages**.
3. Cliquer sur **Integrations** / **Intégrations**.
4. Chercher la carte **Sendcloud API** qui correspond à la connexion MLC.
5. Cliquer sur **Configure** / **Configurer**.
6. Chercher les champs **Public key** et **Secret key**.

**STOP important :** si le secret est masqué ou absent, ne pas cliquer sur **Regenerate keys**. Une régénération invaliderait les clés utilisées par la synchronisation actuelle. Dans ce cas, ouvrir MLC eLogistics avec un compte super-admin, aller dans **Admin → Clients → [compte choisi] → Sendcloud**, et copier les deux valeurs déjà enregistrées. Si elles ne sont pas accessibles non plus, prévenir le développeur ; ne rien modifier dans Sendcloud.

### 3. Copier les deux valeurs dans `.env.local`

1. Ouvrir le fichier `.env.local` situé à la racine du projet.
2. Ajouter ces lignes tout en bas :

```dotenv
SENDCLOUD_TEST_API_KEY=coller_ici_la_Public_key
SENDCLOUD_TEST_SECRET=coller_ici_la_Secret_key
SENDCLOUD_WRITE_VALIDATION_ENABLED=false
```

3. Enregistrer le fichier.
4. Ne jamais envoyer les clés par email, Slack ou capture d’écran. Ne jamais les ajouter à Git.

La **Public key** va dans `SENDCLOUD_TEST_API_KEY`. La **Secret key** va dans `SENDCLOUD_TEST_SECRET`.

### 4. Prévenir le développeur

Envoyer uniquement ce message :

> Compte choisi : ANTEOS (ou Motijet). Les deux clés sont dans `.env.local`.

Le développeur lance lui-même la commande de lecture seule suivante :

```bash
npm run sendcloud:write-validation -- account-fingerprint
```

Cette commande ne crée et ne modifie rien. Elle affiche une empreinte courte, par exemple `sendcloud-test:12ab34cd56ef`. Maxime n’a pas besoin de manipuler cette empreinte.

## Opération technique préparée

### Objet jetable

Le payload final sera généré localement avec un suffixe aléatoire unique :

```json
{
  "parcel": {
    "name": "MLC AUTOFIX TEST",
    "company_name": "MLC TEST AVANT PUT",
    "address": "Rue de la Paix",
    "house_number": "1",
    "city": "Paris",
    "postal_code": "75002",
    "country": "FR",
    "weight": "0.100",
    "order_number": "MLC-AUTOFIX-TEST-<suffixe-unique>",
    "request_label": false,
    "total_order_value": "1.00",
    "total_order_value_currency": "EUR",
    "quantity": 1,
    "parcel_items": [
      {
        "sku": "MLC-AUTOFIX-NO-SKU-<suffixe-unique>",
        "description": "ZZQXVJK-<suffixe-unique>",
        "quantity": 1,
        "weight": "0.100",
        "value": "1.00"
      }
    ]
  }
}
```

Il n’y a ni email, ni téléphone, ni client réel, ni `shipment_uuid`, ni point relais. `request_label=false` interdit la demande d’étiquette. Le SKU et la description sont des valeurs aléatoires sans mot métier, afin d’éviter aussi bien le mapping exact que les mappings par mot-clé ; l’application peut enregistrer un item non mappé, mais ne peut pas consommer de stock sans item mappé. Avant le GO, leur absence de mapping sera contrôlée en lecture seule pour le tenant choisi.

### Séquence et contrats exacts

| Étape | Requête | Vérification | Retour arrière |
|---|---|---|---|
| Création v2 | `POST https://panel.sendcloud.sc/api/v2/parcels` avec le payload ci-dessus | réponse `2xx`, ID numérique, `date_announced` vide, aucun tracking | conserver le token d’annulation ; ne pas demander de label |
| PUT documenté | `PUT https://panel.sendcloud.sc/api/v2/parcels` avec `{"parcel":{"id":<ID>,"company_name":"MLC TEST APRES PUT"}}` | `GET /api/v2/parcels/<ID>` retourne la nouvelle valeur | même PUT avec `company_name="MLC TEST AVANT PUT"` |
| Nettoyage final | `POST https://panel.sendcloud.sc/api/v2/parcels/<ID>/cancel` | `200 cancelled`, statut annulé ou `GET` en `404` | l’objet non annoncé est supprimé/annulé ; aucune étiquette à rembourser |

Le contrat alternatif `PUT /api/v2/parcels/<ID>` ne sera préparé que si le contrat documenté échoue de façon non ambiguë et qu’un GET confirme que le parcel est resté inchangé.

## Approbations demandées à Maxime

Les écritures sont volontairement fractionnées : une approbation ne débloque qu’une requête.

1. Après lecture seule et génération du manifest de création, le développeur communique : compte, empreinte, payload exact, URL et token `APPROVE:v2_create_disposable:...`.
2. Maxime répond exactement : `GO <token>`.
3. Après création et GET de contrôle, le développeur communique l’ID, le diff PUT et un nouveau token `APPROVE:v2_update_documented:...`.
4. Maxime répond exactement : `GO <token>`.
5. La restauration PUT et l’annulation finale utilisent chacune leur token `ROLLBACK:...`. Elles font partie du nettoyage annoncé, mais restent techniquement impossibles sans le token correspondant.

Sans réponse `GO` contenant le token exact, `SENDCLOUD_WRITE_VALIDATION_ENABLED` reste à `false` et aucune écriture n’est lancée.

## Commandes réservées au développeur

### Préparer la création — GET seulement

```bash
npm run sendcloud:write-validation -- scaffold-v2-disposable \
  --payload-file .sendcloud-write-validation/disposable-payload.json

npm run sendcloud:write-validation -- prepare-v2-create-disposable \
  --payload-file .sendcloud-write-validation/disposable-payload.json \
  --manifest .sendcloud-write-validation/disposable-create-manifest.json
```

La première commande ne touche que le disque local et génère les deux suffixes uniques. La deuxième effectue uniquement un GET borné pour vérifier que le marqueur n'existe pas déjà.

### Exécuter la création — seulement après le GO exact

Renseigner d’abord dans `.env.local` l’empreinte affichée et passer le flag à `true` :

```dotenv
SENDCLOUD_TEST_ACCOUNT_FINGERPRINT=sendcloud-test:<empreinte>
SENDCLOUD_WRITE_VALIDATION_ENABLED=true
```

Puis :

```bash
npm run sendcloud:write-validation -- execute \
  --manifest .sendcloud-write-validation/disposable-create-manifest.json \
  --allow-write I_UNDERSTAND_ONE_TEST_OBJECT \
  --approval-token "APPROVE:v2_create_disposable:..."
```

Immédiatement après l’appel, remettre `SENDCLOUD_WRITE_VALIDATION_ENABLED=false` dans `.env.local`.

### En cas de timeout ou de réponse inconnue

Ne jamais relancer le POST. Exécuter uniquement :

```bash
npm run sendcloud:write-validation -- reconcile \
  --manifest .sendcloud-write-validation/disposable-create-manifest.json
```

La réconciliation cherche uniquement le `order_number` unique. Tant que le résultat est inconnu, aucun PUT et aucun second POST ne sont autorisés.

## Résultat attendu de cette validation

- `POST 2xx` : création v2 toujours ouverte pour le compte choisi.
- réponse explicite `403`, `404` ou `410`, puis recherche confirmant zéro objet : création v2 indisponible ; préparer le plan B v3.
- `PUT /api/v2/parcels` réussi et vérifié : corriger `updateParcel` pour utiliser ce contrat.
- PUT documenté refusé mais cible inchangée : préparer séparément le test legacy `/api/v2/parcels/{id}`.
- timeout, `5xx` ou état ambigu : arrêt et réconciliation ; aucun fallback automatique.

Références officielles : [clés API Sendcloud](https://support.sendcloud.com/hc/en-us/articles/360024967012-Sendcloud-API-documentation-and-Quick-Start-Guide), [création v2](https://sendcloud.dev/api/v2/parcels/create-a-parcel-or-parcels), [mise à jour v2](https://sendcloud.dev/api/v2/parcels/update-a-parcel), [annulation v2](https://sendcloud.dev/api/v2/parcels/cancel-a-parcel).
