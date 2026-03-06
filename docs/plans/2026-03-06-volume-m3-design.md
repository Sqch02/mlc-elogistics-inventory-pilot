# Volume m³ par SKU - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `volume_m3` field per SKU and display total stock volume in the Produits page KPIs.

**Architecture:** Add nullable `volume_m3` column to `skus` table. Thread it through GET/POST/PATCH API routes, hooks, and form dialogs. Compute `totalVolume_m3` client-side as sum of (qty_current × volume_m3). Add a 5th KPI card.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL), TypeScript, React Query, Shadcn UI

---

### Task 0: Safety Setup

**Step 1: Create branch**

```bash
git checkout -b feat/volume-m3
```

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/00030_add_volume_m3.sql`

**Step 1: Create migration file**

```sql
-- Add volume_m3 field to SKUs for cubic meter tracking
ALTER TABLE skus ADD COLUMN IF NOT EXISTS volume_m3 NUMERIC;

COMMENT ON COLUMN skus.volume_m3 IS 'Unit volume in cubic meters (m³)';
```

**Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with name `add_volume_m3` and the SQL above.

**Step 3: Build to verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add supabase/migrations/00030_add_volume_m3.sql
git commit -m "feat: Add volume_m3 column to skus table"
```

---

### Task 2: API - Thread volume_m3 Through SKU Routes

**Files:**
- Modify: `src/app/api/skus/route.ts` (GET + POST)
- Modify: `src/app/api/skus/[id]/route.ts` (PATCH)
- Modify: `src/app/api/products/route.ts` (GET - add volume_m3 to select + response)

**Step 1: Update GET /api/skus (route.ts:6-69)**

In the `SKUWithStock` interface (line 6), add `volume_m3`:

```typescript
interface SKUWithStock {
  id: string
  sku_code: string
  name: string
  weight_grams: number | null
  volume_m3: number | null          // ADD THIS
  alert_threshold: number
  created_at: string
  stock_snapshots: Array<{ qty_current: number; updated_at: string }> | null
}
```

In the `.select()` (line 26), add `volume_m3`:

```
.select(`
  id,
  sku_code,
  name,
  weight_grams,
  volume_m3,
  alert_threshold,
  created_at,
  stock_snapshots(qty_current, updated_at)
`)
```

In the map (line 60), add `volume_m3`:

```typescript
const skus = filtered.map((sku: SKUWithStock) => ({
  id: sku.id,
  sku_code: sku.sku_code,
  name: sku.name,
  weight_grams: sku.weight_grams,
  volume_m3: sku.volume_m3,          // ADD THIS
  alert_threshold: sku.alert_threshold,
  created_at: sku.created_at,
  qty_current: sku.stock_snapshots?.[0]?.qty_current || 0,
  stock_updated_at: sku.stock_snapshots?.[0]?.updated_at || null,
}))
```

**Step 2: Update POST /api/skus (route.ts:82-163)**

In the destructuring (line 89), add `volume_m3`:

```typescript
const { sku_code, name, weight_grams, volume_m3, alert_threshold, qty_initial } = body
```

In the insert (line 116), add `volume_m3`:

```typescript
.insert({
  tenant_id: tenantId,
  sku_code,
  name,
  weight_grams: weight_grams || null,
  volume_m3: volume_m3 || null,       // ADD THIS
  alert_threshold: alert_threshold || 10,
})
```

**Step 3: Update PATCH /api/skus/[id] (route.ts:52-135)**

In the destructuring (line 64), add `volume_m3`:

```typescript
const { sku_code, name, description, weight_grams, volume_m3, alert_threshold } = body
```

In the updateData building (line 96-101), add:

```typescript
if (volume_m3 !== undefined) updateData.volume_m3 = volume_m3
```

**Step 4: Update GET /api/products (route.ts)**

In the `.select()` (line 24), add `volume_m3`:

```
.select(`
  id,
  sku_code,
  name,
  volume_m3,
  alert_threshold
`)
```

In the SKURow interface (line 70), add:

```typescript
interface SKURow {
  id: string
  sku_code: string
  name: string
  volume_m3: number | null          // ADD THIS
  alert_threshold: number
}
```

In the return object (line 98), add:

```typescript
return {
  ...existing fields,
  volume_m3: sku.volume_m3,         // ADD THIS
  status: skuStatus,
}
```

In the TransformedSKU interface (line 114), add:

```typescript
volume_m3: number | null            // ADD THIS
```

**Step 5: Build to verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/app/api/skus/route.ts src/app/api/skus/\[id\]/route.ts src/app/api/products/route.ts
git commit -m "feat: Thread volume_m3 through SKU API routes"
```

---

### Task 3: Hooks - Add volume_m3 to Types and Stats

**Files:**
- Modify: `src/hooks/useSkus.ts` (SKU interface + mutations)
- Modify: `src/hooks/useProducts.ts` (Product interface + ProductStats + calculation)

**Step 1: Update useSkus.ts**

Add `volume_m3` to SKU interface (line 6):

```typescript
export interface SKU {
  id: string
  sku_code: string
  name: string
  weight_grams: number | null
  volume_m3: number | null           // ADD THIS
  alert_threshold: number
  qty_current: number
  stock_updated_at: string | null
  created_at: string
}
```

Add `volume_m3` to useCreateSku mutation type (line 35):

```typescript
mutationFn: async (data: {
  sku_code: string
  name: string
  weight_grams?: number
  volume_m3?: number                 // ADD THIS
  alert_threshold?: number
  qty_initial?: number
}) => {
```

Add `volume_m3` to useUpdateSku mutation type (line 68):

```typescript
mutationFn: async ({ id, ...data }: {
  id: string
  sku_code?: string
  name?: string
  weight_grams?: number
  volume_m3?: number                 // ADD THIS
  alert_threshold?: number
}) => {
```

**Step 2: Update useProducts.ts**

Add `volume_m3` to Product interface (line 10):

```typescript
export interface Product {
  sku_code: string
  name: string
  description: string | null
  unit_cost_eur?: number | null
  volume_m3?: number | null          // ADD THIS
  alert_threshold: number
  ...rest stays same
}
```

Add `totalVolume_m3` to ProductStats interface (line 26):

```typescript
export interface ProductStats {
  totalSkus: number
  totalStock: number
  totalConsumption30d: number
  criticalCount: number
  totalVolume_m3: number             // ADD THIS
}
```

Add calculation in fetchProducts (line 45):

```typescript
const stats: ProductStats = {
  totalSkus: skus.length,
  totalStock: skus.reduce((sum, s) => sum + (s.qty_current || 0), 0),
  totalConsumption30d: skus.reduce((sum, s) => sum + (s.consumption_30d || 0), 0),
  criticalCount: skus.filter(s => s.status === 'critical' || s.status === 'rupture').length,
  totalVolume_m3: skus.reduce((sum, s) => sum + ((s.qty_current || 0) * (s.volume_m3 || 0)), 0),
}
```

**Step 3: Build to verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/hooks/useSkus.ts src/hooks/useProducts.ts
git commit -m "feat: Add volume_m3 to hooks and stats calculation"
```

---

### Task 4: Frontend - KPI Card + Form Fields

**Files:**
- Modify: `src/app/(dashboard)/produits/ProduitsClient.tsx`

**Step 1: Add volume_m3 to ProductFormData interface (line 62)**

```typescript
interface ProductFormData {
  sku_code: string
  name: string
  alert_threshold: number
  qty_initial: number
  volume_m3: string                  // ADD THIS (string for input binding)
}
```

Update defaultFormData (line 76):

```typescript
const defaultFormData: ProductFormData = {
  sku_code: '',
  name: '',
  alert_threshold: 10,
  qty_initial: 0,
  volume_m3: '',                     // ADD THIS
}
```

**Step 2: Add Cube icon import (line 17)**

Add `Box` to the lucide-react import (this icon looks like a cube):

```typescript
import { Package, TrendingDown, AlertTriangle, Warehouse, Search, X, Download, Loader2, Plus, MoreHorizontal, Pencil, Trash2, PackagePlus, History, ArrowUpRight, ArrowDownRight, Clock, Upload, BarChart3, Box } from 'lucide-react'
```

**Step 3: Update stats default (line 113)**

```typescript
const stats = data?.stats || { totalSkus: 0, totalStock: 0, totalConsumption30d: 0, criticalCount: 0, totalVolume_m3: 0 }
```

**Step 4: Add 5th KPI card (after line 358, before the closing `</div>` of KPI row)**

Change grid from `md:grid-cols-4` to `md:grid-cols-5` (line 312):

```tsx
<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
```

Add this card after the "Critiques" card (before closing `</div>` of KPI row):

```tsx
<Card>
  <CardContent className="p-4 flex items-center justify-between">
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase">Volume Stock</p>
      <p className="text-2xl font-bold">{stats.totalVolume_m3.toFixed(2)} m³</p>
    </div>
    <div className="p-2 bg-primary/10 rounded-lg text-primary">
      <Box className="h-5 w-5" />
    </div>
  </CardContent>
</Card>
```

**Step 5: Add volume_m3 to handleCreate (line 162)**

```typescript
const handleCreate = async () => {
  await createMutation.mutateAsync({
    sku_code: formData.sku_code,
    name: formData.name,
    alert_threshold: formData.alert_threshold,
    qty_initial: formData.qty_initial,
    volume_m3: formData.volume_m3 ? parseFloat(formData.volume_m3) : undefined,
  })
  setCreateOpen(false)
  setFormData(defaultFormData)
}
```

**Step 6: Add volume_m3 to openEdit (line 174)**

```typescript
const openEdit = (skuCode: string) => {
  const sku = getFullSku(skuCode)
  if (sku) {
    setSelectedSku(sku)
    setFormData({
      sku_code: sku.sku_code,
      name: sku.name,
      alert_threshold: sku.alert_threshold,
      qty_initial: sku.qty_current,
      volume_m3: sku.volume_m3 ? String(sku.volume_m3) : '',
    })
    setEditOpen(true)
  }
}
```

**Step 7: Add volume_m3 to handleEdit (line 188)**

```typescript
const handleEdit = async () => {
  if (!selectedSku) return
  await updateMutation.mutateAsync({
    id: selectedSku.id,
    sku_code: formData.sku_code,
    name: formData.name,
    alert_threshold: formData.alert_threshold,
    volume_m3: formData.volume_m3 ? parseFloat(formData.volume_m3) : undefined,
  })
  setEditOpen(false)
  setSelectedSku(null)
}
```

**Step 8: Add volume_m3 field to Create Dialog (after alert_threshold field, ~line 544)**

Inside the second `grid grid-cols-2` div, add after the alert_threshold field:

```tsx
<div className="space-y-2">
  <Label htmlFor="volume_m3">Volume unitaire (m³)</Label>
  <Input
    id="volume_m3"
    type="number"
    step="any"
    min="0"
    placeholder="0.000118"
    value={formData.volume_m3}
    onChange={(e) => setFormData({ ...formData, volume_m3: e.target.value })}
  />
</div>
```

**Step 9: Add volume_m3 field to Edit Dialog (after alert_threshold field, ~line 592)**

Add after the existing alert_threshold `div`:

```tsx
<div className="space-y-2">
  <Label htmlFor="edit_volume_m3">Volume unitaire (m³)</Label>
  <Input
    id="edit_volume_m3"
    type="number"
    step="any"
    min="0"
    placeholder="0.000118"
    value={formData.volume_m3}
    onChange={(e) => setFormData({ ...formData, volume_m3: e.target.value })}
  />
</div>
```

**Step 10: Build to verify**

```bash
npm run build
```

**Step 11: Commit**

```bash
git add src/app/\(dashboard\)/produits/ProduitsClient.tsx
git commit -m "feat: Add volume m3 KPI card and form fields"
```

---

### Task 5: CSV Import - Add volume_m3

**Files:**
- Modify: `src/lib/validations/import.ts`

**Step 1: Add volume_m3 to skuImportRowSchema (line 4)**

```typescript
export const skuImportRowSchema = z.object({
  sku_code: z.string().min(1, 'SKU code requis'),
  name: z.string().min(1, 'Nom requis'),
  weight_grams: z.coerce.number().optional().nullable(),
  volume_m3: z.coerce.number().optional().nullable(),    // ADD THIS
  qty_current: z.coerce.number().int().min(0).optional().default(0),
  active: z.string().optional().transform((v) => v?.toLowerCase() !== 'false'),
})
```

**Step 2: Build to verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/validations/import.ts
git commit -m "feat: Add volume_m3 to SKU CSV import schema"
```

---

### Task 6: Merge and Push

**Step 1: Merge to main**

```bash
git checkout main
git merge feat/volume-m3
```

**Step 2: Final build**

```bash
npm run build
```

**Step 3: Push**

```bash
git push origin main
```

**Step 4: Cleanup**

```bash
git branch -d feat/volume-m3
```

---

## Verification Checklist

- [ ] `npm run build` passes
- [ ] Migration applied to DB
- [ ] Volume m³ KPI card visible on Produits page (5th card)
- [ ] Create product form has volume field
- [ ] Edit product form has volume field and loads existing value
- [ ] CSV import accepts optional volume_m3 column
- [ ] Total volume = sum of (qty × volume_m3) for all SKUs
