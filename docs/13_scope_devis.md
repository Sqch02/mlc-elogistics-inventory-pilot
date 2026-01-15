# Scope Devis V1 Pilote - 2 500 EUR HT

## Section 1 : Cadrage + Architecture (400 EUR)
- Socle applicatif frontend (Next.js) + backend (API Routes)
- Modele de donnees Supabase + migrations
- Authentification securisee + separation donnees pilote
- Deploiement initial sur Render

## Section 2 : Integration Sendcloud (650 EUR)
- Connexion Sendcloud (compte pilote)
- Synchronisation incrementale + idempotence (anti-doublons)
- Historisation expeditions pour KPI
- **Poids de reference = poids sur etiquette Sendcloud**

## Section 3 : Stock / SKUs / Previsions (550 EUR)
- Import SKUs & stock initial (Google Sheet / CSV)
- Calculs : expedie/jour, expedie/mois, moyenne 90j, jours de stock restants
- Reassorts (quantite + date ETA) + projection stock previsionnel
- Dashboard & indicateurs essentiels

## Section 4 : Bundles BOM (250 EUR)
- Import table Bundles (Google Sheet / CSV)
- Decomposition bundle en composants selon BOM
- Calcul de consommation reelle par composants

## Section 5 : Emplacements (300 EUR)
- Import structure Rack et Emplacement (Google Sheet / CSV)
- **Regle V1 : 1 seul produit par emplacement**
- Gestion localisation produit/emplacement + recherche
- **Quantite par emplacement NON incluse** (stock global uniquement)

## Section 6 : Pricing + Facturation + Reclamations (350 EUR)
- **Pricing transport** : grille transporteur + tranches de poids (depuis fichier PRICING)
- **Calcul cout transport** par expedition + recapitulatif mensuel
- **Facturation mensuelle** : generation recap + export CSV (aligne sur exemple facture fourni)
- **Reclamations** : suivi (fichier SUIVI RECLAMATION), statuts, **indemnisation manuelle** (montant saisi), total indemnise mensuel

---

## Points Actes (Contraintes)

| Regle | Description |
|-------|-------------|
| Poids pricing | Base sur poids etiquette Sendcloud |
| Pricing | Transporteur + tranches de poids **uniquement** |
| Reclamations | Indemnisation **manuelle** (montant saisi au cas par cas) |
| Emplacements | **1 seul produit par emplacement** |
| Quantites | Gerees au **niveau stock global** |
| Multi-clients | Prevu **en fin de V1** apres validation pilote |

---

## Hors Perimetre (Explicite)

- WMS complet (picking, scan, preparation avancee)
- Pricing complexe (volumetrique, surcharges, exceptions nombreuses)
- Automatisations avancees
- **Integration comptable (FEC, Sage, etc.)**
- Quantite par emplacement

---

## Hypotheses V1

- Imports via CSV (export Google Sheets accepte)
- Un seul client pilote (multi-tenant prepare mais non deploye)
- Sync Sendcloud manuelle ou planifiee (frequence non specifiee)
- Export facturation = CSV (pas PDF)
