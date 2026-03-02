# Migration Donnees Florna : MLC → Tenant Florna

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deplacer toutes les donnees Florna du tenant MLC vers le tenant Florna, sans toucher au code applicatif.

**Architecture:** Migration SQL pure (UPDATE tenant_id). Toutes les tables ont un champ tenant_id. On change juste l'etiquette "proprietaire" de chaque ligne. Le RLS, le switch tenant et l'app fonctionnent deja en multi-tenant. Zero changement de code.

**Tech Stack:** SQL (Supabase SQL Editor ou MCP), PostgreSQL

---

## Scope de la migration

| Table | Lignes | Direction |
|---|---|---|
| shipments | 39 070 | MLC → Florna |
| shipment_items | 16 203 | MLC → Florna |
| sync_runs | 8 086 | MLC → Florna |
| claims | 1 357 | MLC → Florna |
| pricing_rules | 189 | MLC → Florna |
| locations | 88 | MLC → Florna |
| skus | 25 | MLC → Florna |
| bundles | 19 | MLC → Florna |
| stock_snapshots | 7 | MLC → Florna |
| invoices_monthly | 2 | MLC → Florna |
| invoice_lines | 0 | MLC → Florna |
| bundle_components | 0 | MLC → Florna |
| location_assignments | 0 | MLC → Florna |
| inbound_restock | 0 | MLC → Florna |
| tenant_settings | 1 | COPIER (MLC garde la sienne) |
| profiles | 1 | contact+florna → Florna |

**Ne PAS migrer :**
- `lespineux.maxime@gmail.com` (super_admin MLC) → reste MLC
- `aurelien@famillia.fr` (super_admin MLC) → reste MLC

---

## Ordre de migration (respecte les FK)

Les FK sont intra-tenant, donc l'ordre d'UPDATE n'a pas d'impact sur les contraintes (on ne change pas les references, juste le tenant_id). Mais par securite, on migre les parents avant les enfants :

1. **Niveau 0** : tenant_settings (copie, pas deplacement)
2. **Niveau 1** : skus, locations, shipments, pricing_rules, invoices_monthly, sync_runs, claims
3. **Niveau 2** : stock_snapshots, bundles, shipment_items, invoice_lines, location_assignments, inbound_restock
4. **Niveau 3** : bundle_components
5. **Profils** : contact+florna uniquement

---

## Task 1 : Verification pre-migration

**Step 1 : Verifier que le tenant Florna existe**

```sql
SELECT id, name, code, is_active FROM tenants
WHERE id = 'f1073a00-0000-4000-a000-000000000001';
```

Attendu : 1 ligne, Florna, actif.

**Step 2 : Verifier qu'il n'y a aucune donnee sur Florna**

```sql
SELECT 'skus' as tbl, count(*) FROM skus WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001'
UNION ALL SELECT 'shipments', count(*) FROM shipments WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001'
UNION ALL SELECT 'profiles', count(*) FROM profiles WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
```

Attendu : tout a 0.

---

## Task 2 : Script de migration

Variables :
- `MLC_ID = '00000000-0000-0000-0000-000000000001'`
- `FLORNA_ID = 'f1073a00-0000-4000-a000-000000000001'`

```sql
-- ============================================
-- MIGRATION FLORNA : MLC → TENANT FLORNA
-- Date : 2026-02-11
-- Reversible : OUI (voir rollback en bas)
-- ============================================

BEGIN;

-- 0. Copier tenant_settings (Sendcloud config)
INSERT INTO tenant_settings (tenant_id, sendcloud_api_key, sendcloud_secret, sendcloud_webhook_secret, sync_enabled, invoice_prefix, invoice_next_number, payment_terms, bank_details, default_vat_rate, created_at, updated_at)
SELECT
  'f1073a00-0000-4000-a000-000000000001',
  sendcloud_api_key, sendcloud_secret, sendcloud_webhook_secret, sync_enabled,
  invoice_prefix, invoice_next_number, payment_terms, bank_details, default_vat_rate,
  now(), now()
FROM tenant_settings
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (tenant_id) DO UPDATE SET
  sendcloud_api_key = EXCLUDED.sendcloud_api_key,
  sendcloud_secret = EXCLUDED.sendcloud_secret,
  sendcloud_webhook_secret = EXCLUDED.sendcloud_webhook_secret,
  sync_enabled = EXCLUDED.sync_enabled,
  invoice_prefix = EXCLUDED.invoice_prefix,
  invoice_next_number = EXCLUDED.invoice_next_number,
  payment_terms = EXCLUDED.payment_terms,
  bank_details = EXCLUDED.bank_details,
  default_vat_rate = EXCLUDED.default_vat_rate;

-- 1. Tables niveau 1 (pas de FK enfant vers autre table tenant-scoped)
UPDATE skus SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE locations SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE shipments SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE pricing_rules SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE invoices_monthly SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE sync_runs SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE claims SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 2. Tables niveau 2 (FK vers tables niveau 1)
UPDATE stock_snapshots SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE bundles SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE shipment_items SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE invoice_lines SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE location_assignments SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE inbound_restock SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 3. Tables niveau 3
UPDATE bundle_components SET tenant_id = 'f1073a00-0000-4000-a000-000000000001' WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 4. Profil client uniquement (PAS les super_admin)
UPDATE profiles SET tenant_id = 'f1073a00-0000-4000-a000-000000000001'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
AND role = 'client';

COMMIT;
```

---

## Task 3 : Verification post-migration

```sql
-- Verifier que MLC est vide (sauf profiles super_admin)
SELECT 'skus' as tbl, count(*) FROM skus WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'shipments', count(*) FROM shipments WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'shipment_items', count(*) FROM shipment_items WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'claims', count(*) FROM claims WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'pricing_rules', count(*) FROM pricing_rules WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
-- Attendu : tout a 0

-- Verifier que Florna a les donnees
SELECT 'skus' as tbl, count(*) FROM skus WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001'
UNION ALL SELECT 'shipments', count(*) FROM shipments WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001'
UNION ALL SELECT 'shipment_items', count(*) FROM shipment_items WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001'
UNION ALL SELECT 'claims', count(*) FROM claims WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001'
UNION ALL SELECT 'pricing_rules', count(*) FROM pricing_rules WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
-- Attendu : skus=25, shipments=39070, shipment_items=16203, claims=1357, pricing_rules=189

-- Verifier profils
SELECT email, role, tenant_id FROM profiles ORDER BY tenant_id, role;
-- Attendu : contact+florna sur Florna, les 2 super_admin sur MLC
```

---

## Task 4 : Script de ROLLBACK (en cas de probleme)

```sql
-- ============================================
-- ROLLBACK : Florna → MLC
-- Annule completement la migration
-- ============================================

BEGIN;

-- Profil client
UPDATE profiles SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001'
AND role = 'client';

-- Niveau 3
UPDATE bundle_components SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';

-- Niveau 2
UPDATE stock_snapshots SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE bundles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE shipment_items SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE invoice_lines SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE location_assignments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE inbound_restock SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';

-- Niveau 1
UPDATE skus SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE locations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE shipments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE pricing_rules SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE invoices_monthly SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE sync_runs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
UPDATE claims SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';

-- Supprimer la copie tenant_settings Florna
DELETE FROM tenant_settings WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';

COMMIT;
```

---

## Risques et mitigations

| Risque | Mitigation |
|---|---|
| FK constraint violation | Impossible : on change juste tenant_id, les refs internes (sku_id, shipment_id) ne changent pas |
| Unique constraint violation | Impossible : Florna est vide, aucun conflit possible |
| App casse pendant migration | Transaction atomique (BEGIN/COMMIT), tout ou rien |
| Donnees perdues | Aucune deletion. UPDATE reversible en 30 secondes |
| Sync Sendcloud ecrit dans mauvais tenant | tenant_settings copie vers Florna = sync vise Florna. Supprimer config MLC apres validation |
| Super_admin ne voit plus rien | Switch tenant vers Florna dans l'UI. Super_admin voit tout |

## Post-migration

1. Se connecter a l'app en tant que super_admin
2. Switcher sur le tenant **Florna** en haut
3. Verifier : Dashboard, Expeditions, Produits, Pricing, etc.
4. Se connecter en tant que `contact+florna` → doit voir les donnees
5. Si tout OK : supprimer les credentials Sendcloud du tenant MLC (optionnel)
6. Creer le compte Lena (`lena.roux@gmail.com`, role client) sur le tenant Florna
