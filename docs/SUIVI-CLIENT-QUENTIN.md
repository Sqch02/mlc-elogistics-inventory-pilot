# Suivi Projet HME Logistics - Client Quentin

> Document de suivi des demandes, realisations et evolutions

---

## 1. REALISE (Dans le cadre du devis)

### Expeditions

| Fonctionnalite | Description | Date |
|----------------|-------------|------|
| Indicateur erreur | Triangle orange sur les expeditions avec erreur Sendcloud | 29/01/2026 |
| Affichage message erreur | Message d'erreur visible dans la modale de modification | 29/01/2026 |
| Bouton modifier | Modification adresse/ville avec sync Sendcloud | 29/01/2026 |
| Gestion integration shipments | Les commandes "On Hold" (UUID) sont modifiables localement avec message explicatif | 29/01/2026 |
| Filtre "Problemes" corrige | Ne remonte plus les commandes en transit (91, 92), uniquement les vraies erreurs | 29/01/2026 |
| Bouton X recherche | Effacer la recherche rapidement | 28/01/2026 |
| Colonne tracking complete | Numero de suivi complet visible et cliquable dans le tableau | 29/01/2026 |

### Reclamations

| Fonctionnalite | Description | Date |
|----------------|-------------|------|
| Colonne tracking | Numero de suivi cliquable dans le tableau des reclamations | 29/01/2026 |
| Statuts indemnite distincts | "Indemnise par HME" et "Indemnise par transporteur" affiches separement | 29/01/2026 |
| Montant indemnite editable | Champ indemnite toujours visible et modifiable dans le formulaire | 29/01/2026 |

### Analytics

| Fonctionnalite | Description | Date |
|----------------|-------------|------|
| Date picker avec presets | Aujourd'hui, 7j, 14j, 30j, Ce mois, Dernier mois, Plage personnalisee | 28/01/2026 |
| Graphique SKU vendus | Top 10 des produits expedies par periode (barres horizontales) | 29/01/2026 |
| Correction SKU Sales | Le graphique affiche maintenant les donnees correctement | 29/01/2026 |

### Emplacements

| Fonctionnalite | Description | Date |
|----------------|-------------|------|
| Colonne DLUO | Date de peremption des produits dans la grille | 28/01/2026 |
| Emplacements inaccessibles | Configuration des emplacements bloques : B211, C210, C211, D209, E201, F201, F202, G102, G202 | 29/01/2026 |
| Correction A204 | N'est plus marque comme inaccessible | 29/01/2026 |

### Corrections techniques

| Correction | Description | Date |
|------------|-------------|------|
| Detection erreur Sendcloud | Seules les vraies erreurs sont detectees (pas tous les "On Hold") | 29/01/2026 |
| Status IDs corriges | 91/92 = transit (pas erreur), vrais problemes = 1002, 1337, 8, 80, 62996, 62992, 62991, 2000 | 29/01/2026 |
| Messages erreur detailles | Affichage des vraies erreurs Sendcloud (adresse trop longue, devise invalide, etc.) | 29/01/2026 |

---

## 2. A FAIRE (Dans le cadre du devis)

*Toutes les taches du devis ont ete completees.*

---

## 3. HORS DEVIS (Evolutions demandees)

### Reclamations - Systeme de chat

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Chat/Commentaires | Ajouter un systeme de discussion sur chaque reclamation pour voir les echanges avec le SAV | Elevee | 2-3 jours |
| Historique messages | Conserver l'historique des messages par reclamation | Moyenne | Inclus |
| Notifications | Systeme de notification pour nouveaux messages | Moyenne | 1 jour |

### ~~Integration Sendcloud Support~~ - IMPOSSIBLE

| Fonctionnalite | Description | Statut |
|----------------|-------------|--------|
| ~~Sync messages Sendcloud~~ | ~~Recuperer automatiquement les messages de reclamation depuis Sendcloud~~ | **IMPOSSIBLE - Limitation API** |
| ~~Maj automatique statuts~~ | ~~Mettre a jour le statut quand Sendcloud repond~~ | **IMPOSSIBLE - Limitation API** |

> **Note technique (verifie le 31/01/2026) :** L'API Sendcloud Support (BETA) permet uniquement de CREER des tickets. Il n'existe AUCUN endpoint pour lister les tickets, voir un ticket, ou recuperer les messages/reponses des transporteurs. Aucun webhook n'existe non plus pour les tickets. C'est une decision de design de Sendcloud. Sources : documentation officielle api.sendcloud.dev et sendcloud.dev

### Onglet Discussion centralise

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Page Discussions | Onglet dedie pour voir toutes les discussions/notifications | Moyenne | 1-2 jours |
| Filtres par statut | Filtrer les discussions ouvertes/fermees | Faible | Inclus |

### Correction automatique erreurs Sendcloud

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Devise CHF → EUR | Convertir automatiquement les devises avant envoi Sendcloud | Moyenne | Inclus |
| Adresse trop longue | Detecter et alerter/tronquer les adresses > 35 caracteres | Moyenne | Inclus |
| Pays/Code HS manquant | Ajouter automatiquement FRANCE et code HS 210690 | Faible | Inclus |
| Point Relais auto | Trouver le point relais le plus proche si non selectionne | Elevee | +1-2 jours |
| **Total corrections** | Middleware de validation avant Sendcloud | Elevee | 3-4 jours |

### Portail Client (Self-Service Marques)

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Authentification client | Role "client" separe avec acces limite | Elevee | Inclus |
| Dashboard client | Vue limitee aux donnees du client (marque) | Elevee | Inclus |
| Creation reclamations | Les marques peuvent creer leurs propres reclamations | Moyenne | Inclus |
| Suivi reclamations | Voir l'etat de leurs reclamations | Moyenne | Inclus |
| Chat integre | Communication via le systeme de chat | Moyenne | Inclus |
| **Total portail** | Interface complete self-service | Tres elevee | 5-7 jours |

### Onglet Receptions (Inbound)

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Liste receptions | Page pour voir toutes les receptions de stock | Moyenne | Inclus |
| Creation reception | Client ou HME declare une reception a venir | Moyenne | Inclus |
| Controle reception | Valider quantites recues, etat (OK/endommage/manquant) | Elevee | Inclus |
| Photos | Upload photos de preuve de reception | Moyenne | Inclus |
| Sync stock | Mise a jour automatique du stock apres validation | Elevee | Inclus |
| **Total receptions** | Gestion complete des entrees de stock | Elevee | 4-5 jours |

### Creation Etiquettes depuis l'app

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Bouton creer etiquette | Generer etiquette Sendcloud depuis l'app | Moyenne | Inclus |
| Selection transporteur | Choisir le service de livraison | Moyenne | Inclus |
| Telechargement PDF | Recuperer et afficher le PDF de l'etiquette | Faible | Inclus |
| **Total etiquettes** | Creation complete d'etiquettes | Moyenne | 2-3 jours |

### Messagerie generale (style Slack)

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Conversations | Discussions directes entre utilisateurs | Elevee | Inclus |
| Lien commande/reclamation | Associer un message a une commande specifique | Moyenne | Inclus |
| Notifications temps reel | Alertes pour nouveaux messages | Elevee | Inclus |
| **Total messagerie** | Systeme de communication interne | Elevee | 4-5 jours |

### Estimation totale hors devis

| Lot | Fonctionnalites | Estimation | Statut |
|-----|-----------------|------------|--------|
| Chat reclamations | Chat + historique + notifications | 3-4 jours | Faisable |
| ~~Integration Sendcloud~~ | ~~Sync messages + maj statuts~~ | ~~2-3 jours~~ | **IMPOSSIBLE** |
| Onglet Discussions | Page + filtres | 1-2 jours | Faisable |
| Corrections auto | Devise, adresse, pays, point relais | 3-4 jours | Faisable |
| Portail Client | Interface self-service marques | 5-7 jours | Faisable |
| Receptions | Gestion entrees de stock | 4-5 jours | Faisable |
| Etiquettes | Creation depuis l'app | 2-3 jours | Faisable |
| Messagerie | Communication interne | 4-5 jours | Faisable |
| **TOTAL** | | **22-30 jours** | |

---

## 4. Historique des deployments

| Date | Version | Modifications |
|------|---------|---------------|
| 29/01/2026 | v1.x | Colonne tracking expeditions/reclamations, statuts indemnite distincts, montant editable |
| 29/01/2026 | v1.x | Fix detection erreurs, SKU sales chart, emplacements inaccessibles |
| 29/01/2026 | v1.x | Fix filtre Problemes, gestion integration shipments |
| 28/01/2026 | v1.x | Date picker Analytics, colonne DLUO, indicateur erreur |

---

## 5. Notes techniques

### Detection des erreurs Sendcloud

Les vrais status d'erreur sont :
- `1002` : Announcement failed
- `1337` : Unknown status
- `8` : Delivery attempt failed
- `80` : Unable to deliver
- `62996` : Exception
- `62992` : Returned to sender
- `62991` : Refused by recipient
- `2000` : Cancelled

Les status de transit (PAS des erreurs) :
- `91` : Parcel en route
- `92` : Driver en route
- `1`, `3`, `7`, `12`, `22` : Autres etats de transit

### Integration Shipments (On Hold)

Les commandes venant de Shopify via Sendcloud ont un `sendcloud_id` au format UUID. Ces commandes :
- Ne peuvent PAS etre modifiees via l'API Sendcloud `/parcels/{id}`
- Doivent etre modifiees directement dans le panel Sendcloud
- Une fois l'etiquette creee, elles deviennent des "parcels" modifiables

### Limitation API Sendcloud - Support Tickets (verifie 31/01/2026)

L'API Sendcloud Support (BETA) a des limitations importantes :

**Ce que l'API PERMET :**
- `POST` Creer des tickets (damaged, lost, delayed, etc.)
- `POST` Uploader des fichiers
- `GET` Recuperer les contacts support transporteur
- `GET` Voir les donnees demandees par Sendcloud (requested data)
- `POST` Repondre aux demandes de Sendcloud

**Ce que l'API NE PERMET PAS :**
- `GET /tickets` - Lister tous les tickets : **N'EXISTE PAS**
- `GET /tickets/{id}` - Voir un ticket : **N'EXISTE PAS**
- `GET /tickets/{id}/messages` - Voir les messages : **N'EXISTE PAS**
- Webhooks pour tickets : **N'EXISTE PAS**

**Sources verifiees :**
- https://api.sendcloud.dev/docs/sendcloud-public-api/support
- https://sendcloud.dev/api/v3/support

**Consequence :** La synchronisation automatique des messages de reclamation Sendcloud est IMPOSSIBLE. Alternative : chat interne dans l'app.

---

*Document mis a jour le 31/01/2026*
