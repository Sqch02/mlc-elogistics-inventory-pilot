# Recette et tests d'acceptation

## Tests fonctionnels minimaux
- Import SKUs et stock initial sans erreur
- Import BOM bundles, décomposition correcte
- Sync Sendcloud: aucune duplication après 2 exécutions
- Pricing: une expédition match une tranche et calcule un coût
- Facture mensuelle: génération + export CSV
- Réclamation: création, passage en indemnisee, total mensuel correct
- Emplacements: import, assignation, respect 1 SKU par emplacement

## Données de test
- Utiliser dataset pilote réel + un mini dataset artificiel (5 SKUs, 2 bundles, 10 shipments)
