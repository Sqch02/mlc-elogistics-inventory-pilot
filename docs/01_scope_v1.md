# Périmètre V1

## Inclus V1
1. Authentification (compte(s) internes) + rôles simples
2. Connexion Sendcloud pour le client pilote
3. Synchronisation incrémentale des expéditions/shipments (anti-doublons / idempotence)
4. Catalogue SKUs (import Google Sheet) + stock initial
5. Bundles (BOM) import Google Sheet + décomposition consommation
6. Calculs:
   - pièces expédiées par jour / mois
   - moyenne journalière sur 90 jours
   - jours de stock restants (projection simple)
7. Réassorts attendus (qty + date ETA)
8. Emplacements:
   - structure d'emplacements import (rack/emplacement)
   - 1 SKU par emplacement
   - localisation SKU -> emplacement, et recherche
9. Pricing transport:
   - grille transporteur + tranches de poids import
   - coût transport par expédition basé sur poids label Sendcloud
10. Facturation mensuelle:
   - récap mensuel + export CSV
   - alignement sur l'exemple de facture fourni (base, pas une compta complète)
11. Réclamations (SAV):
   - workflow simple + statuts
   - indemnisation manuelle (montant saisi)
   - total indemnisé mensuel

## Hors périmètre (sauf avenant)
- WMS complet (picking/packing/scan)
- Quantité par emplacement (stock par emplacement)
- Pricing complexe (volumétrique, surcharges multiples, exceptions nombreuses)
- Automatisation avancée des réclamations
- Intégration comptable
- Portail admin multi-tenant avancé (au-delà du minimum)
