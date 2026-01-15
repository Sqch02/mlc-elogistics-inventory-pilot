# Recette V1 Pilote - Checklist de Tests

## 1. Cadrage + Architecture

### TEST-1.1 : Authentification
- **Pre-requis** : Compte utilisateur cree
- **Action** : Se connecter avec email/mot de passe
- **Resultat** : Acces au dashboard, donnees filtrees par tenant

### TEST-1.2 : Deploiement
- **Pre-requis** : App deployee sur Render
- **Action** : Acceder a l'URL de production
- **Resultat** : Application fonctionnelle, pas d'erreurs 500

---

## 2. Integration Sendcloud

### TEST-2.1 : Connexion Sendcloud
- **Pre-requis** : Cles API configurees
- **Action** : Lancer une synchronisation manuelle
- **Resultat** : Expeditions recuperees, affichees dans la liste

### TEST-2.2 : Anti-doublons (Idempotence)
- **Pre-requis** : Au moins 10 expeditions synchronisees
- **Action** : Relancer la synchronisation 2 fois
- **Resultat** : **Aucun doublon cree**, nombre d'expeditions inchange

### TEST-2.3 : Poids Sendcloud
- **Pre-requis** : Expedition avec poids sur etiquette
- **Action** : Verifier le poids affiche dans l'app
- **Resultat** : Poids = poids etiquette Sendcloud (pas d'arrondi non demande)

---

## 3. Stock / SKUs / Previsions

### TEST-3.1 : Import SKUs
- **Pre-requis** : Fichier CSV avec 5 SKUs
- **Action** : Upload via Parametres > Imports > SKUs
- **Resultat** : 5 SKUs crees avec stock initial

### TEST-3.2 : Calculs de consommation
- **Pre-requis** : SKU avec historique d'expeditions
- **Action** : Ouvrir detail SKU
- **Resultat** : Affichage de expedie/jour, moyenne 90j, jours restants

### TEST-3.3 : Reassorts + Projection
- **Pre-requis** : SKU existant
- **Action** : Import reassort (qty=100, eta_date=J+7)
- **Resultat** : Stock projete = stock actuel + 100

---

## 4. Bundles BOM

### TEST-4.1 : Import Bundles
- **Pre-requis** : SKUs composants existants
- **Action** : Import CSV bundle (ex: BUNDLE-A = 2x SKU-1 + 1x SKU-2)
- **Resultat** : Bundle cree avec decomposition correcte

### TEST-4.2 : Consommation Bundle
- **Pre-requis** : Bundle expedie via Sendcloud
- **Action** : Verifier stock des composants apres sync
- **Resultat** : Stock deduit selon BOM (2x SKU-1, 1x SKU-2)

---

## 5. Emplacements

### TEST-5.1 : Import Emplacements
- **Pre-requis** : Fichier CSV avec 10 emplacements
- **Action** : Upload via imports
- **Resultat** : 10 emplacements crees

### TEST-5.2 : Assignation SKU
- **Pre-requis** : SKU et emplacement existants
- **Action** : Assigner SKU-1 a emplacement A-01-01
- **Resultat** : Assignation enregistree

### TEST-5.3 : Regle 1 SKU/emplacement
- **Pre-requis** : Emplacement deja occupe par SKU-1
- **Action** : Tenter d'assigner SKU-2 au meme emplacement
- **Resultat** : **Erreur ou remplacement** (pas 2 SKUs simultanes)

### TEST-5.4 : Recherche emplacement
- **Pre-requis** : SKU assigne
- **Action** : Rechercher "SKU-1" dans emplacements
- **Resultat** : Emplacement correspondant affiche

---

## 6. Pricing + Facturation + Reclamations

### TEST-6.1 : Import Pricing
- **Pre-requis** : Fichier CSV avec regles pricing
- **Action** : Upload regles (ex: Colissimo 0-500g = 4.50EUR)
- **Resultat** : Regles importees, visibles dans liste

### TEST-6.2 : Calcul cout expedition
- **Pre-requis** : Expedition Colissimo 300g synchronisee
- **Action** : Verifier cout calcule
- **Resultat** : Cout = 4.50EUR (tranche 0-500g)

### TEST-6.3 : Tarif manquant
- **Pre-requis** : Expedition sans regle pricing correspondante
- **Action** : Verifier affichage
- **Resultat** : **Statut "tarif manquant"**, non inclus dans total facture

### TEST-6.4 : Export CSV Facturation
- **Pre-requis** : Facture mensuelle generee
- **Action** : Exporter en CSV
- **Resultat** : Fichier CSV conforme a l'exemple fourni

### TEST-6.5 : Reclamation - Creation
- **Pre-requis** : Expedition problematique
- **Action** : Creer reclamation manuellement
- **Resultat** : Reclamation creee avec statut "ouverte"

### TEST-6.6 : Reclamation - Indemnisation manuelle
- **Pre-requis** : Reclamation existante
- **Action** : Passer en "indemnisee", saisir montant 50EUR
- **Resultat** : Montant enregistre, total mensuel mis a jour

### TEST-6.7 : Total indemnise mensuel
- **Pre-requis** : Plusieurs reclamations indemnisees
- **Action** : Verifier dashboard ou rapport
- **Resultat** : Total = somme des indemnisations du mois

---

## Donnees de Test Minimales

- 5 SKUs (dont 2 composants de bundle)
- 2 Bundles (1 simple, 1 multi-composants)
- 10 Emplacements
- 5 Regles pricing (2 transporteurs, tranches differentes)
- 10 Expeditions (dont 1 bundle, 1 sans tarif)
- 3 Reclamations (1 ouverte, 1 indemnisee, 1 refusee)
