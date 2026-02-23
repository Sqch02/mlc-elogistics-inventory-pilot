# Sendcloud SKU Mapping - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-link Sendcloud shipments to SKUs via a description mapping table so stock decreases automatically.

**Architecture:** New table `sendcloud_sku_mappings` maps Sendcloud item descriptions to SKU IDs. Sync and webhook routes do a fallback lookup in this table when the Sendcloud `sku` field is empty. A backfill endpoint reprocesses historical shipments after the Feb 17 inventory date.

**Tech Stack:** Supabase (Postgres), Next.js API routes, existing `consumeStock()` pipeline.

---

### Task 1: Create migration - mapping table + unmapped_items column

**Files:**
- Create: `supabase/migrations/00026_sendcloud_sku_mappings.sql`

**Step 1: Write migration SQL**

```sql
-- Table to map Sendcloud item descriptions to SKU/bundle codes
CREATE TABLE IF NOT EXISTS sendcloud_sku_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description_pattern TEXT NOT NULL,
  sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_mapping_tenant_desc
  ON sendcloud_sku_mappings(tenant_id, LOWER(description_pattern));

CREATE INDEX idx_mapping_tenant
  ON sendcloud_sku_mappings(tenant_id);

-- Column to store unmatched parcel items for later mapping
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS unmapped_items JSONB;

COMMENT ON TABLE sendcloud_sku_mappings IS 'Maps Sendcloud parcel_items descriptions to SKU/bundle IDs';
COMMENT ON COLUMN shipments.unmapped_items IS 'Parcel items that could not be matched to any SKU during sync';
```

**Step 2: Apply migration via Supabase MCP**

Run the SQL above via `mcp__supabase__execute_sql`.

**Step 3: Commit**

```bash
git add supabase/migrations/00026_sendcloud_sku_mappings.sql
git commit -m "feat: ajouter table sendcloud_sku_mappings et colonne unmapped_items"
```

---

### Task 2: Seed mappings from historical data

**Files:**
- Create: `src/app/api/admin/sku-mappings/seed/route.ts`

**Step 1: Write seed endpoint**

This endpoint extracts known description→SKU pairs from historical shipments that have both `raw_json.parcel_items` and `shipment_items`.

```typescript
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireRole } from '@/lib/supabase/auth'

export async function POST() {
  try {
    await requireRole(['super_admin'])
    const db = getAdminDb()

    // Extract mappings from single-item shipments with known shipment_items
    const { data: mappings, error } = await db.rpc('extract_sku_mappings')

    if (error) {
      // Fallback: use raw SQL approach
      const { data, error: sqlError } = await db
        .from('shipments')
        .select(`
          raw_json,
          shipment_items(sku_id)
        `)
        .not('raw_json', 'is', null)
        .eq('tenant_id', tenantId)
        // Only shipments with exactly 1 parcel_item and 1 shipment_item
      // ... complex - better to use SQL directly
    }

    return NextResponse.json({ success: true, count: mappings?.length || 0 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
```

Actually, since the extraction query is complex, execute it directly via Supabase MCP SQL:

```sql
INSERT INTO sendcloud_sku_mappings (tenant_id, description_pattern, sku_id)
SELECT DISTINCT ON (s.tenant_id, raw_json->'parcel_items'->0->>'description')
  s.tenant_id,
  raw_json->'parcel_items'->0->>'description' as description_pattern,
  si.sku_id
FROM shipments s
JOIN shipment_items si ON si.shipment_id = s.id
WHERE s.tenant_id = 'f1073a00-0000-4000-a000-000000000001'
  AND jsonb_array_length(s.raw_json->'parcel_items') = 1
  AND (SELECT COUNT(*) FROM shipment_items si2 WHERE si2.shipment_id = s.id) = 1
  AND raw_json->'parcel_items'->0->>'description' IS NOT NULL
ON CONFLICT (tenant_id, LOWER(description_pattern)) DO NOTHING;
```

**Step 2: Run seed via Supabase MCP and verify count**

```sql
SELECT COUNT(*) FROM sendcloud_sku_mappings
WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
-- Expected: ~43 rows
```

**Step 3: Verify a few mappings look correct**

```sql
SELECT m.description_pattern, s.sku_code, s.name
FROM sendcloud_sku_mappings m
JOIN skus s ON s.id = m.sku_id
WHERE m.tenant_id = 'f1073a00-0000-4000-a000-000000000001'
ORDER BY m.description_pattern
LIMIT 10;
```

**Step 4: Commit**

```bash
git add supabase/migrations/00026_sendcloud_sku_mappings.sql
git commit -m "feat: seed 43 mappings description Sendcloud -> SKU depuis historique"
```

---

### Task 3: Modify sync route to use mapping fallback

**Files:**
- Modify: `src/app/api/sync/sendcloud/run/route.ts` (lines 104-110, 225-262)

**Step 1: Load mappings alongside SKUs (after line 110)**

Add after the `skuMap` creation (line 110):

```typescript
// Get description->SKU mappings for fallback matching
const { data: descMappings } = await adminClient
  .from('sendcloud_sku_mappings')
  .select('description_pattern, sku_id')
  .eq('tenant_id', tenantId)

const descMap = new Map<string, string>(
  descMappings?.map((m: { description_pattern: string; sku_id: string }) =>
    [m.description_pattern.toLowerCase(), m.sku_id]
  ) || []
)
```

**Step 2: Modify item matching (replace lines 225-262)**

Replace the existing item processing block with:

```typescript
        // Process items if available
        if (parcel.items && parcel.items.length > 0 && shipment) {
          const unmappedItems: Array<{ description: string; qty: number }> = []

          for (const item of parcel.items) {
            // 1. Try direct SKU code match (existing behavior)
            let skuId = skuMap.get(item.sku_code.toLowerCase())

            // 2. Fallback: try description mapping
            if (!skuId && item.description) {
              skuId = descMap.get(item.description.toLowerCase())
            }

            if (skuId) {
              const { error: itemError } = await adminClient
                .from('shipment_items')
                .upsert(
                  {
                    tenant_id: tenantId,
                    shipment_id: shipment.id,
                    sku_id: skuId,
                    qty: item.qty,
                  },
                  { onConflict: 'shipment_id,sku_id' }
                )

              if (!itemError) {
                stats.itemsCreated++

                // ONLY consume stock for NEW shipments (not updates)
                if (isNewShipment) {
                  try {
                    const consumeResults = await consumeStock(
                      tenantId,
                      skuId,
                      item.qty,
                      shipment.id,
                      'shipment'
                    )
                    stats.stockConsumed += consumeResults.length
                  } catch (stockError) {
                    console.error(`[Sync] Error consuming stock for SKU ${item.sku_code}:`, stockError)
                  }
                }
              }
            } else if (item.description) {
              unmappedItems.push({ description: item.description, qty: item.qty })
            }
          }

          // Store unmapped items on the shipment for later mapping
          if (unmappedItems.length > 0) {
            await adminClient
              .from('shipments')
              .update({ unmapped_items: unmappedItems })
              .eq('id', shipment.id)
          }
        }
```

**Step 3: Verify build passes**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/api/sync/sendcloud/run/route.ts
git commit -m "feat: fallback mapping description->SKU dans sync Sendcloud"
```

---

### Task 4: Modify webhook route with same fallback

**Files:**
- Modify: `src/app/api/webhooks/sendcloud/route.ts` (item processing section ~lines 600-643)

**Step 1: Add mapping load**

Find where `skuMap` is created in the webhook route (similar pattern to sync route). Add `descMap` loading right after, same code as Task 3 Step 1.

**Step 2: Apply same matching logic**

Replace the item processing block with the same pattern as Task 3 Step 2 (try skuMap first, then descMap, store unmapped).

**Step 3: Verify build passes**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/api/webhooks/sendcloud/route.ts
git commit -m "feat: fallback mapping description->SKU dans webhook Sendcloud"
```

---

### Task 5: Create backfill endpoint

**Files:**
- Create: `src/app/api/stock/backfill-items/route.ts`

**Step 1: Write backfill endpoint**

```typescript
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireRole } from '@/lib/supabase/auth'
import { getFastTenantId } from '@/lib/supabase/fast-auth'

export async function POST() {
  try {
    await requireRole(['super_admin', 'admin'])
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant non trouve' }, { status: 400 })
    }

    const db = getAdminDb()

    // Load description mappings
    const { data: mappings } = await db
      .from('sendcloud_sku_mappings')
      .select('description_pattern, sku_id')
      .eq('tenant_id', tenantId)

    const descMap = new Map<string, string>(
      mappings?.map((m: { description_pattern: string; sku_id: string }) =>
        [m.description_pattern.toLowerCase(), m.sku_id]
      ) || []
    )

    if (descMap.size === 0) {
      return NextResponse.json({
        error: 'Aucun mapping configure. Lancez le seed d\'abord.'
      }, { status: 400 })
    }

    // Get shipments after inventory date (Feb 17) without shipment_items
    const INVENTORY_DATE = '2026-02-17T00:00:00Z'

    const { data: shipments } = await db
      .from('shipments')
      .select('id, raw_json, sendcloud_id')
      .eq('tenant_id', tenantId)
      .gte('shipped_at', INVENTORY_DATE)
      .not('raw_json', 'is', null)
      .eq('is_return', false)

    if (!shipments || shipments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucune expedition a traiter',
        stats: { processed: 0, matched: 0, unmapped: 0 }
      })
    }

    const stats = {
      total: shipments.length,
      processed: 0,
      itemsCreated: 0,
      unmapped: 0,
      skipped: 0,
      errors: 0,
    }

    for (const shipment of shipments) {
      const parcelItems = shipment.raw_json?.parcel_items
      if (!parcelItems || parcelItems.length === 0) {
        stats.skipped++
        continue
      }

      // Check if shipment already has items
      const { count } = await db
        .from('shipment_items')
        .select('*', { count: 'exact', head: true })
        .eq('shipment_id', shipment.id)

      if (count && count > 0) {
        stats.skipped++
        continue
      }

      const unmappedItems: Array<{ description: string; qty: number }> = []

      for (const item of parcelItems) {
        const desc = item.description?.toLowerCase()
        const skuId = desc ? descMap.get(desc) : null

        if (skuId) {
          const { error } = await db
            .from('shipment_items')
            .upsert(
              {
                tenant_id: tenantId,
                shipment_id: shipment.id,
                sku_id: skuId,
                qty: item.quantity || 1,
              },
              { onConflict: 'shipment_id,sku_id' }
            )

          if (!error) stats.itemsCreated++
        } else if (item.description) {
          unmappedItems.push({
            description: item.description,
            qty: item.quantity || 1,
          })
        }
      }

      if (unmappedItems.length > 0) {
        await db
          .from('shipments')
          .update({ unmapped_items: unmappedItems })
          .eq('id', shipment.id)
        stats.unmapped++
      }

      stats.processed++

      if (stats.processed % 200 === 0) {
        console.log(`[Backfill] Progress: ${stats.processed}/${stats.total}`)
      }
    }

    console.log('[Backfill] Done:', stats)

    return NextResponse.json({
      success: true,
      message: `Backfill termine: ${stats.itemsCreated} items crees, ${stats.unmapped} expeditions avec items non mappes`,
      stats,
    })
  } catch (error) {
    console.error('[Backfill] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify build passes**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/stock/backfill-items/route.ts
git commit -m "feat: endpoint backfill-items pour rattraper expeditions post-inventaire"
```

---

### Task 6: Create mappings CRUD API

**Files:**
- Create: `src/app/api/admin/sku-mappings/route.ts`

**Step 1: Write GET (list) + POST (create) + DELETE**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireRole } from '@/lib/supabase/auth'
import { getFastTenantId } from '@/lib/supabase/fast-auth'

// GET: List all mappings for tenant
export async function GET() {
  try {
    await requireRole(['super_admin', 'admin'])
    const tenantId = await getFastTenantId()
    const db = getAdminDb()

    const { data: mappings } = await db
      .from('sendcloud_sku_mappings')
      .select('id, description_pattern, sku_id, created_at, skus(sku_code, name)')
      .eq('tenant_id', tenantId)
      .order('description_pattern')

    // Also get unmapped descriptions
    const { data: unmapped } = await db
      .from('shipments')
      .select('unmapped_items')
      .eq('tenant_id', tenantId)
      .not('unmapped_items', 'is', null)

    // Aggregate unique unmapped descriptions
    const unmappedDescs = new Map<string, number>()
    for (const s of unmapped || []) {
      for (const item of s.unmapped_items || []) {
        const key = item.description
        unmappedDescs.set(key, (unmappedDescs.get(key) || 0) + item.qty)
      }
    }

    return NextResponse.json({
      mappings: mappings || [],
      unmapped: Array.from(unmappedDescs.entries()).map(([desc, qty]) => ({
        description: desc,
        total_qty: qty,
      })).sort((a, b) => b.total_qty - a.total_qty),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST: Create a new mapping
export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin'])
    const tenantId = await getFastTenantId()
    const db = getAdminDb()
    const body = await request.json()

    const { description_pattern, sku_id } = body

    if (!description_pattern || !sku_id) {
      return NextResponse.json(
        { error: 'description_pattern et sku_id requis' },
        { status: 400 }
      )
    }

    const { data, error } = await db
      .from('sendcloud_sku_mappings')
      .insert({
        tenant_id: tenantId,
        description_pattern,
        sku_id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ce mapping existe deja' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ mapping: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a mapping
export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin'])
    const tenantId = await getFastTenantId()
    const db = getAdminDb()

    const { id } = await request.json()

    await db
      .from('sendcloud_sku_mappings')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/admin/sku-mappings/route.ts
git commit -m "feat: API CRUD pour gestion des mappings Sendcloud"
```

---

### Task 7: Add mappings management UI to Parametres page

**Files:**
- Modify: `src/app/(dashboard)/parametres/ParametresClient.tsx`

**Step 1: Add a new tab "Mappings Sendcloud" in the settings page**

Add a new `TabsTrigger` and `TabsContent` section. The UI should show:

- **Top:** KPI badge "X mappings actifs" + "X descriptions non mappees" (warning badge if > 0)
- **Table of existing mappings:** description_pattern | SKU code | SKU name | Delete button
- **Section "Non mappes":** List of unmapped descriptions with qty, each with a "Mapper" button that opens a dialog to select a SKU
- **Buttons:** "Lancer le backfill" (calls POST /api/stock/backfill-items), "Recalculer stock" (calls existing POST /api/stock/recalculate)

Use existing UI patterns from the Sendcloud sync tab and stock recalculation tab in the same ParametresClient.tsx file.

**Step 2: Wire up API calls**

- `GET /api/admin/sku-mappings` to load data
- `POST /api/admin/sku-mappings` to create new mapping
- `DELETE /api/admin/sku-mappings` to remove
- `POST /api/stock/backfill-items` to run backfill
- `POST /api/stock/recalculate` to recalculate stock after backfill

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/parametres/ParametresClient.tsx
git commit -m "feat: UI gestion mappings Sendcloud dans Parametres"
```

---

### Task 8: Run seed + backfill + recalculate for Florna

**Step 1: Seed mappings from historical data**

Run via Supabase MCP:
```sql
INSERT INTO sendcloud_sku_mappings (tenant_id, description_pattern, sku_id)
SELECT DISTINCT ON (raw_json->'parcel_items'->0->>'description')
  s.tenant_id,
  raw_json->'parcel_items'->0->>'description',
  si.sku_id
FROM shipments s
JOIN shipment_items si ON si.shipment_id = s.id
WHERE s.tenant_id = 'f1073a00-0000-4000-a000-000000000001'
  AND jsonb_array_length(s.raw_json->'parcel_items') = 1
  AND (SELECT COUNT(*) FROM shipment_items si2 WHERE si2.shipment_id = s.id) = 1
  AND raw_json->'parcel_items'->0->>'description' IS NOT NULL
ON CONFLICT DO NOTHING;
```

**Step 2: Verify seed count**

```sql
SELECT COUNT(*) FROM sendcloud_sku_mappings
WHERE tenant_id = 'f1073a00-0000-4000-a000-000000000001';
```

**Step 3: Run backfill via the UI or curl**

```bash
curl -X POST https://app.homemade-elogistics.com/api/stock/backfill-items \
  -H "Cookie: <auth-cookies>"
```

Or trigger from the Parametres UI.

**Step 4: Run stock recalculate**

```bash
curl -X POST https://app.homemade-elogistics.com/api/stock/recalculate \
  -H "Cookie: <auth-cookies>"
```

**Step 5: Verify stock decreased**

```sql
SELECT s.sku_code, ss.qty_current
FROM stock_snapshots ss
JOIN skus s ON s.id = ss.sku_id
WHERE ss.tenant_id = 'f1073a00-0000-4000-a000-000000000001'
ORDER BY s.sku_code;
```

Stock should now be lower than the Feb 17 inventory values.

**Step 6: Final commit + push**

```bash
git add -A
git commit -m "feat: systeme de mapping Sendcloud -> SKU pour consommation stock automatique"
git push
```
