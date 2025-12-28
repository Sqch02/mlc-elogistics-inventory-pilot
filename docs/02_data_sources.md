# Sources de données

## Google Sheets (fournies par le client)
- SKU_STOCK: liste SKUs + stock initial
- BUNDLES_BOM: bundle_sku, component_sku, qty
- PRICING: transporteur, tranche_poids_min, tranche_poids_max, prix
- RACKS_EMPLACEMENTS: structure des emplacements
- RECLAMATIONS: suivi réclamations (structure à respecter)
- FACTURE_EXEMPLE: PDF exemple de facture

## Sendcloud
Objectif: importer les expéditions/shipments expédiés du client pilote.
Champs minimum nécessaires:
- identifiant shipment/parcel
- date expédition
- transporteur/service
- poids (poids label)
- référence commande / tracking
- lignes/produits si disponible, sinon mapping via règles internes

Note: si Sendcloud ne fournit pas les lignes SKU, prévoir une stratégie:
- soit l'info est dans la référence/metadata
- soit via mapping côté 3PL
- soit via export complémentaire fourni par le client
