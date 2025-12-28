# Règles métier

## Consommation SKU
- Chaque expédition consomme des quantités par SKU.
- Si l'expédition contient un bundle, convertir en composants via BOM:
  - consommation(component) += qty_bundle * qty_component

## Poids pour pricing transport
- Utiliser le poids affiché sur le label / l'expédition Sendcloud.
- Pas de volumétrique ni surcharge en V1, sauf ajout explicite.

## Pricing transport
- Coût = prix(tranche_poids, transporteur)
- Tranches: inclure min/max (à définir précisément: ex min inclus, max exclu)
- Si aucun match:
  - marquer l'expédition comme "tarif manquant" (warning)
  - ne pas casser la facture, mais isoler en "à compléter"

## Facturation mensuelle
- Regrouper par mois calendaire (timezone Europe/Paris sauf mention contraire)
- Sortie V1:
  - export CSV récap (transporteur, tranche, nb expéditions, total)
  - total général
- Ne pas gérer TVA/mentions légales dans le moteur, c'est un export.

## Réclamations
- Création manuelle d'une réclamation (ou import depuis sheet si demandé)
- Statuts recommandés:
  - ouverte, en_analyse, indemnisee, refusee, cloturee
- Indemnisation manuelle:
  - champ montant_indemnisation (num)
  - champ decision_date, decision_by
- Reporting mensuel:
  - total indemnisé sur la période
