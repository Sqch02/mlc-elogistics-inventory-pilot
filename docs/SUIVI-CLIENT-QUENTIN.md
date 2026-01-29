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

### Integration Sendcloud Support

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Sync messages Sendcloud | Recuperer automatiquement les messages de reclamation depuis Sendcloud | Elevee | 2-3 jours |
| Maj automatique statuts | Mettre a jour le statut quand Sendcloud repond | Moyenne | Inclus |

### Onglet Discussion centralise

| Fonctionnalite | Description | Complexite | Estimation |
|----------------|-------------|------------|------------|
| Page Discussions | Onglet dedie pour voir toutes les discussions/notifications | Moyenne | 1-2 jours |
| Filtres par statut | Filtrer les discussions ouvertes/fermees | Faible | Inclus |

### Estimation totale hors devis

| Lot | Fonctionnalites | Estimation |
|-----|-----------------|------------|
| Chat reclamations | Chat + historique + notifications | 3-4 jours |
| Integration Sendcloud | Sync messages + maj statuts | 2-3 jours |
| Onglet Discussions | Page + filtres | 1-2 jours |
| **TOTAL** | | **6-9 jours** |

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

---

*Document mis a jour le 29/01/2026*
