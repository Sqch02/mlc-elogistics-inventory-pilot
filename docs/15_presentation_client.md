# Presentation Client - MLC Inventory V1 Pilote

**Document de demonstration des fonctionnalites**

---

## Navigation Principale

L'application comporte **9 onglets principaux** accessibles depuis le menu lateral :

1. Dashboard
2. Expeditions
3. Produits & Stock
4. Bundles
5. Emplacements
6. Pricing
7. Facturation
8. Reclamations
9. Parametres

---

## 1. DASHBOARD (Tableau de Bord)

### Objectif
Vue d'ensemble de l'activite logistique avec indicateurs cles et graphiques.

### Fonctionnalites a presenter

**Cartes KPI principales :**
- Nombre total d'expeditions du mois
- Chiffre d'affaires facturation
- Stock critique (alertes)
- Taux de reclamations

**Graphiques :**
- **Courbe des expeditions** : Volume journalier sur le mois selectionne
- **Repartition par transporteur** : Part de chaque carrier (Colissimo, Chronopost, etc.)
- **Evolution des couts** : Tendance des couts de transport
- **Sante du stock** : Indicateur visuel du niveau de stock global

**Interactions :**
- Selecteur de mois (12 derniers mois)
- Clic sur KPI = navigation vers la page detaillee
- Generation rapide de facture mensuelle

---

## 2. EXPEDITIONS

### Objectif
Gestion et suivi de toutes les expeditions synchronisees depuis Sendcloud.

### Fonctionnalites a presenter

**Liste des expeditions :**
| Colonne | Description |
|---------|-------------|
| Reference | Numero de commande client |
| Destinataire | Nom + email du client final |
| Date | Date et heure d'expedition |
| Statut | 20+ statuts Sendcloud (En transit, Livre, Exception...) |
| Transporteur | Colissimo, Chronopost, DPD, etc. |
| Poids | Poids en grammes (depuis etiquette Sendcloud) |
| Cout | Prix calcule selon grille tarifaire |
| Statut tarif | OK ou "Tarif manquant" |

**Filtres disponibles :**
- Recherche par reference ou destinataire
- Filtre par transporteur
- Filtre par statut
- Filtre par periode (date debut / fin)
- Filtre par statut pricing (OK / Manquant)

**Actions :**
- **Rafraichir** : Re-synchroniser le statut depuis Sendcloud
- **Voir details** : Ligne expandable avec adresse complete, tracking, items
- **Telecharger etiquette** : PDF de l'etiquette Sendcloud
- **Creer reclamation** : Ouvre directement une reclamation liee
- **Export CSV** : Telecharger la liste filtree

**Pagination :**
- 10, 25, 50, 100 lignes par page
- Navigation premiere/derniere page

---

## 3. PRODUITS & STOCK

### Objectif
Gestion du catalogue SKUs et suivi du stock en temps reel.

### Fonctionnalites a presenter

**Liste des produits :**
| Colonne | Description |
|---------|-------------|
| Code SKU | Identifiant unique du produit |
| Nom | Designation du produit |
| Quantite | Stock actuel |
| Seuil alerte | Niveau declenchant une alerte |
| Statut | En stock / Faible / Critique / Rupture |
| Emplacement | Localisation dans l'entrepot |
| Derniere MAJ | Date du dernier mouvement |

**Codes couleur statut :**
- **Vert** : En stock (qty > seuil x 2)
- **Jaune** : Faible (qty > seuil mais < seuil x 2)
- **Orange** : Critique (qty <= seuil)
- **Rouge** : Rupture (qty = 0)

**Ligne expandable - Details du SKU :**
- Historique des mouvements de stock (entrees/sorties)
- Graphique des volumes mensuels (12 derniers mois)
- Calculs automatiques :
  - Expedie/jour (moyenne)
  - Expedie/mois (total)
  - Moyenne 90 jours
  - Jours de stock restants (projection)

**Actions :**
- **Creer SKU** : Formulaire avec code, nom, stock initial, seuil
- **Modifier** : Edition de tous les champs
- **Supprimer** : Avec confirmation
- **Ajustement stock** : +/- manuel avec motif obligatoire
- **Import CSV** : Import en masse depuis fichier

---

## 4. BUNDLES (Kits / BOM)

### Objectif
Gestion des bundles (kits composes de plusieurs SKUs).

### Fonctionnalites a presenter

**Concept Bundle :**
Un bundle = 1 code SKU parent qui se decompose en plusieurs SKUs composants.
Exemple : BUNDLE-DECO = 2x VASE-001 + 1x BOUGIE-002 + 3x FLEUR-003

**Liste des bundles :**
| Colonne | Description |
|---------|-------------|
| Code Bundle | SKU du kit |
| Nom | Designation |
| Composants | Nombre de lignes de composition |
| Stock disponible | Min des composants (goulot d'etranglement) |

**Ligne expandable - Composition :**
- Liste des composants avec quantites
- Stock disponible de chaque composant
- Indicateur de disponibilite du bundle

**Actions :**
- **Creer bundle** : Selection du SKU parent + ajout composants
- **Modifier composition** : Ajouter/supprimer/modifier quantites
- **Import CSV** : Format `bundle_code,component_sku,quantity`

**Logique metier :**
- Quand un bundle est expedie, le stock des composants est deduit automatiquement
- Le stock du bundle = MIN(stock_composant / qty_requise) pour chaque composant

---

## 5. EMPLACEMENTS

### Objectif
Gestion de la structure d'entreposage et localisation des produits.

### Fonctionnalites a presenter

**Structure hierarchique :**
- Rack (ex: A, B, C...)
- Niveau/Etagere (ex: 01, 02, 03...)
- Position (ex: 01, 02...)
- Code complet : A-01-01, B-02-03, etc.

**Liste des emplacements :**
| Colonne | Description |
|---------|-------------|
| Code | Identifiant unique (ex: A-01-01) |
| Label | Description libre |
| Statut | Occupe / Vide / Bloque |
| SKU assigne | Produit stocke a cet emplacement |

**Statistiques affichees :**
- Total emplacements
- Emplacements occupes
- Emplacements vides
- Taux d'occupation (%)

**Regle V1 importante :**
> **1 seul produit par emplacement** (pas de multi-SKU)

**Actions :**
- **Creer emplacement** : Code + label + statut
- **Assigner SKU** : Lier un produit a un emplacement
- **Bloquer/Debloquer** : Marquer comme indisponible
- **Import CSV** : Import en masse de la structure

**Recherche :**
- Par code emplacement
- Par SKU assigne
- Par statut

---

## 6. PRICING (Grille Tarifaire)

### Objectif
Configuration des regles de calcul du cout de transport.

### Fonctionnalites a presenter

**Structure d'une regle :**
| Champ | Description |
|-------|-------------|
| Transporteur | Colissimo, Chronopost, DPD, etc. |
| Destination | France, Europe, International |
| Poids min (g) | Borne inferieure (incluse) |
| Poids max (g) | Borne superieure (exclue) |
| Prix (EUR) | Cout HT de l'expedition |

**Exemple de grille :**
```
Colissimo | France | 0-500g    | 4.50 EUR
Colissimo | France | 500-1000g | 6.20 EUR
Colissimo | France | 1000-2000g| 7.80 EUR
Chronopost| France | 0-500g    | 8.90 EUR
...
```

**Logique de calcul :**
1. Recuperation du poids depuis etiquette Sendcloud
2. Identification du transporteur
3. Determination de la destination
4. Recherche de la regle : `carrier + destination + (min <= poids < max)`
5. Si trouvee : cout = prix de la regle
6. Si non trouvee : `pricing_status = 'missing'`

**Actions :**
- **Creer regle** : Formulaire complet
- **Modifier** : Edition de tous les champs
- **Supprimer** : Avec confirmation
- **Import CSV** : Import en masse depuis fichier pricing

**Gestion des tarifs manquants :**
- Expeditions sans regle = marquees "Tarif manquant"
- Visibles dans un onglet separe sur la facturation
- Non incluses dans le total facture (a traiter manuellement)

---

## 7. FACTURATION

### Objectif
Generation et suivi des factures mensuelles.

### Fonctionnalites a presenter

**Liste des factures :**
| Colonne | Description |
|---------|-------------|
| Numero | Format FAC-YYYYMM-XXX |
| Mois | Periode concernee |
| Statut | Brouillon / En attente / Payee / En retard |
| Total HT | Montant hors taxes |
| TVA | Montant TVA (20%) |
| Total TTC | Montant toutes taxes |
| Date creation | Date de generation |

**Statuts et workflow :**
1. **Brouillon** : Facture generee, modifiable
2. **En attente** : Envoyee au client, en attente de paiement
3. **Payee** : Reglement recu
4. **En retard** : Echeance depassee

**Ligne expandable - Details facture :**
Liste des lignes avec :
- Type (Transport, Stockage, Preparation, etc.)
- Description
- Quantite
- Prix unitaire
- Total HT
- TVA
- Total TTC

**Generation de facture :**
1. Selectionner le mois
2. Clic "Generer facture"
3. Calcul automatique :
   - Toutes expeditions du mois avec pricing OK
   - Agregation par transporteur/destination
   - Application TVA 20%

**Exports disponibles :**
- **PDF** : Facture formatee avec logo et coordonnees
- **CSV** : Export des lignes pour comptabilite

**Alertes :**
- Nombre d'expeditions avec "tarif manquant" affiche
- Ces expeditions ne sont PAS incluses dans la facture

---

## 8. RECLAMATIONS (SAV)

### Objectif
Suivi des reclamations clients (colis perdus, endommages, retards).

### Fonctionnalites a presenter

**Liste des reclamations :**
| Colonne | Description |
|---------|-------------|
| Reference | Numero commande concernee |
| Type | Perdu / Endommage / Retard / Contenu errone / Manquant / Autre |
| Statut | Ouverte / En analyse / Indemnisee / Refusee / Fermee |
| Priorite | Basse / Normale / Haute / Urgente |
| Montant | Indemnisation accordee (si applicable) |
| Date creation | Date d'ouverture |
| Echeance | Date limite de traitement |

**Workflow des statuts :**
```
Ouverte → En analyse → Indemnisee → Fermee
                    → Refusee    → Fermee
```

**Types de reclamation :**
- **Perdu** : Colis non livre, introuvable
- **Endommage** : Colis arrive abime
- **Retard** : Livraison hors delai annonce
- **Contenu errone** : Mauvais produit envoye
- **Manquant** : Article manquant dans le colis
- **Autre** : Cas particuliers

**Priorites et echeances :**
| Priorite | Delai traitement |
|----------|------------------|
| Urgente | 1 jour |
| Haute | 3 jours |
| Normale | 7 jours |
| Basse | 14 jours |

**Actions :**
- **Creer reclamation** : Formulaire avec tous les champs
- **Modifier statut** : Progression dans le workflow
- **Saisir indemnisation** : Montant manuel au cas par cas
- **Ajouter note** : Commentaire dans l'historique
- **Voir historique** : Timeline de toutes les actions

**Indemnisation :**
> Montant saisi **manuellement** au cas par cas (pas de calcul automatique)

**Indicateurs :**
- Total reclamations ouvertes
- Total indemnise du mois
- Taux de reclamations (vs expeditions)

---

## 9. PARAMETRES

### Objectif
Configuration de l'application et imports de donnees.

### Onglets disponibles

#### 9.1 Profil Utilisateur
- Nom affiche
- Email (lecture seule)
- Role (lecture seule)

#### 9.2 Societe
- Raison sociale
- SIRET / SIREN
- Numero TVA
- Adresse complete
- Conditions de paiement
- Parametres facturation

#### 9.3 Imports CSV
**Hub centralise pour tous les imports :**

| Type d'import | Description |
|---------------|-------------|
| SKUs | Code, nom, stock initial, seuil alerte |
| Bundles | Bundle parent, composants, quantites |
| Pricing | Transporteur, destination, tranches poids, prix |
| Emplacements | Code, label, statut |
| Restock (Reassorts) | SKU, quantite, date ETA |
| Items expeditions | Lien SKU-Expedition pour retroactif |
| Reclamations | Import reclamations existantes |

**Processus d'import :**
1. Telecharger le template CSV
2. Remplir avec vos donnees
3. Uploader le fichier
4. **Previsualisation** avec detection des erreurs
5. Confirmation et import

#### 9.4 Synchronisation Sendcloud
- **Sync manuelle** : Bouton pour lancer une synchronisation immediate
- **Historique des syncs** : Liste des dernieres executions
- **Statut** : Succes/Echec, nombre d'expeditions traitees

#### 9.5 Recalcul Stock
- **Bouton recalcul** : Recalcule tout le stock depuis les mouvements
- Utile apres un import ou une correction
- Affiche le resultat avec delta

---

## Fonctionnalites Transversales

### Authentification
- Connexion par email/mot de passe
- Sessions securisees
- Deconnexion automatique apres inactivite

### Multi-tenant
- Donnees isolees par client
- Chaque utilisateur voit uniquement ses donnees
- Preparation pour plusieurs clients (V2)

### Responsive Design
- Interface adaptee desktop, tablette, mobile
- Menu lateral retractable sur mobile
- Tableaux scrollables horizontalement

### Exports
- CSV disponible sur toutes les listes
- PDF pour factures
- Telechargement immediat

### Notifications
- Toasts de confirmation (succes, erreur)
- Alertes visuelles pour stocks critiques
- Indicateurs de statut colores

---

## Integration Sendcloud

### Synchronisation
- **Webhook temps reel** : Mise a jour instantanee des statuts
- **CRON backup** : Sync toutes les 15 minutes (securite)
- **Sync manuelle** : Declenchable depuis Parametres

### Donnees synchronisees
- Expeditions avec tous les details
- Statuts (20+ codes)
- Poids sur etiquette (= poids facturation)
- Tracking number et URL
- Informations destinataire

### Idempotence
- Chaque expedition a un `sendcloud_id` unique
- Pas de doublons meme si sync multiple
- Mise a jour des statuts sans duplication

---

## Points Cles a Mettre en Avant

### Ce qui est FAIT et FONCTIONNEL

1. **Sync Sendcloud complete** avec webhook temps reel
2. **Gestion de stock** avec alertes et projections
3. **Bundles** avec decomposition automatique
4. **Pricing** par transporteur et tranches de poids
5. **Facturation mensuelle** avec export CSV
6. **Reclamations** avec workflow complet
7. **Emplacements** avec regle 1 SKU/emplacement
8. **Imports CSV** pour toutes les donnees
9. **Dashboard** avec KPIs et graphiques
10. **Multi-tenant** prepare (1 client pilote actif)

### Regles Metier Implementees

- Poids = poids etiquette Sendcloud (pas d'arrondi)
- Tarif manquant = isole, non facture
- Indemnisation = saisie manuelle
- 1 produit par emplacement maximum
- Stock global (pas de qty par emplacement)

---

## Donnees de Demonstration

Pour la demo, preparer :
- 5-10 SKUs avec stocks varies
- 2-3 bundles avec compositions
- 10+ emplacements
- Regles pricing pour 2-3 transporteurs
- 20+ expeditions synchronisees
- 3-4 reclamations (differents statuts)
- 1 facture mensuelle generee

---

## Questions Frequentes

**Q: Comment ajouter un nouveau produit ?**
R: Produits & Stock > Creer SKU ou Import CSV

**Q: Comment voir ou est stocke un produit ?**
R: Emplacements > Rechercher par SKU

**Q: Pourquoi une expedition n'a pas de cout ?**
R: Pas de regle pricing correspondante → ajouter dans Pricing

**Q: Comment creer une facture ?**
R: Facturation > Selectionner mois > Generer

**Q: Les donnees sont-elles securisees ?**
R: Oui, authentification obligatoire + isolation par tenant

---

*Document genere le 19/01/2026 - MLC Inventory V1 Pilote*
