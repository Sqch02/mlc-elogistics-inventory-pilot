# Sendcloud SKU Mapping - Design Document

**Date** : 2026-02-23
**Statut** : Approuve
**Probleme** : Le stock Florna ne diminue pas depuis le 28 janvier. Les shipment_items ne sont pas crees car Sendcloud n'envoie pas de code SKU (champ vide), seulement des descriptions libres.

## Solution

Table de mapping `sendcloud_sku_mappings` qui fait le lien entre les descriptions Sendcloud et les SKU/bundles.

### Table

```sql
sendcloud_sku_mappings (
  id UUID PK,
  tenant_id UUID FK tenants,
  description_pattern TEXT,         -- description exacte Sendcloud (case-insensitive)
  sku_id UUID FK skus,              -- SKU ou bundle cible
  created_at TIMESTAMPTZ
)
UNIQUE(tenant_id, description_pattern)
```

### Flux sync modifie

1. Cherche `parcel_items[].sku` dans table `skus` (comportement actuel)
2. Si pas trouve → cherche `parcel_items[].description` dans `sendcloud_sku_mappings` (case-insensitive)
3. Si trouve → cree `shipment_item` + `consumeStock()`
4. Si pas trouve → stocke dans `shipments.unmapped_items` (JSONB)

### Seed initial

43 mappings extraits automatiquement de l'historique (shipments avec shipment_items + 1 parcel_item).

### Backfill

Endpoint `POST /api/stock/backfill-items` :
- Traite les expeditions apres le 17 fevrier 2026 (date inventaire physique)
- Lit `raw_json -> parcel_items` pour chaque expedition sans shipment_items
- Matche via sendcloud_sku_mappings
- Cree les shipment_items manquants
- Puis `/api/stock/recalculate` consomme le stock

### UI admin

- Page parametres ou section dans Produits
- Liste des mappings existants (description → SKU)
- Badge alerte "X descriptions non mappees"
- Dialog pour mapper une description inconnue a un SKU
