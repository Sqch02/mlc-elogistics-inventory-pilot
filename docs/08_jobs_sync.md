# Jobs et synchronisation

## Job Sendcloud (quotidien)
- Objectif: récupérer les nouvelles expéditions depuis la dernière exécution.
- Stocker un curseur (date/offset) ou utiliser pagination stable.
- Idempotence: unique(sendcloud_id) sur shipments.

## Etapes du job
1) Démarrer sync_run
2) Appeler Sendcloud API pour récupérer shipments depuis last_sync
3) Upsert shipments
4) Construire shipment_items si source SKU disponible
5) Recalculer agrégats (ou à la demande):
   - conso jour/mois
   - stock prévisionnel
6) Terminer sync_run avec stats
7) En cas d'erreur: status failed, stocker message, reprendre possible

## Génération facture (mensuelle)
- A la demande via UI (ou job)
- Calculer coûts par expédition via pricing_rules
- Regrouper en lignes et total
- Marquer expéditions sans tarif: ligne spéciale "tarif manquant"
