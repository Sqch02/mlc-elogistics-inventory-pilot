# Sendcloud Error Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect and display Sendcloud validation errors for integration shipments (orders "On Hold") so users see which orders need attention.

**Architecture:** Add `has_error` and `error_message` fields to shipments table and ParsedShipment type. During sync, detect errors from Sendcloud response (order_status, errors field, or validation issues). Display error indicator in ExpeditionsClient only when `has_error = true`.

**Tech Stack:** Supabase (PostgreSQL), Next.js, TypeScript, Sendcloud API

---

## Task 1: Add Error Fields to Database

**Files:**
- Create: `supabase/migrations/00015_add_shipment_error_fields.sql`

**Step 1: Create migration file**

```sql
-- Add error detection fields to shipments
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS has_error boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS error_message text;

-- Index for quick filtering of shipments with errors
CREATE INDEX IF NOT EXISTS idx_shipments_has_error ON shipments(tenant_id, has_error) WHERE has_error = true;

-- Comment
COMMENT ON COLUMN shipments.has_error IS 'True if Sendcloud reported validation/processing errors for this shipment';
COMMENT ON COLUMN shipments.error_message IS 'Error message from Sendcloud if has_error is true';
```

**Step 2: Apply migration via Supabase MCP**

Run: Apply migration using `mcp__supabase__apply_migration`

**Step 3: Commit**

```bash
git add supabase/migrations/00015_add_shipment_error_fields.sql
git commit -m "feat: add has_error and error_message fields to shipments table"
```

---

## Task 2: Update ParsedShipment Type

**Files:**
- Modify: `src/lib/sendcloud/types.ts:71-113`

**Step 1: Add error fields to ParsedShipment interface**

Add these fields after `items`:

```typescript
export interface ParsedShipment {
  // ... existing fields ...
  items?: Array<{
    sku_code: string
    qty: number
    description?: string
    value?: number
  }>
  // Error detection fields
  has_error: boolean
  error_message: string | null
}
```

**Step 2: Commit**

```bash
git add src/lib/sendcloud/types.ts
git commit -m "feat: add has_error and error_message to ParsedShipment type"
```

---

## Task 3: Update Sendcloud Integration Shipment Interface

**Files:**
- Modify: `src/lib/sendcloud/client.ts:264-294`

**Step 1: Add error fields to SendcloudIntegrationShipment interface**

```typescript
interface SendcloudIntegrationShipment {
  shipment_uuid: string
  order_number: string
  external_order_id?: string
  name: string
  email?: string
  telephone?: string
  company_name?: string
  address: string
  address_2?: string
  house_number?: string
  city: string
  postal_code: string
  country: string
  order_status: { id: string; message: string }
  payment_status?: { id: string; message: string }
  shipping_method?: number
  shipping_method_checkout_name?: string
  to_service_point?: number
  total_order_value?: string
  currency?: string
  created_at: string
  updated_at?: string
  parcel_items?: Array<{
    sku?: string
    description: string
    quantity: number
    weight?: string
    value?: string
  }>
  // Error fields from Sendcloud
  errors?: Record<string, string[]>
  warnings?: string[]
  checkout_payload_errors?: string[]
}
```

**Step 2: Commit**

```bash
git add src/lib/sendcloud/client.ts
git commit -m "feat: add error fields to SendcloudIntegrationShipment interface"
```

---

## Task 4: Update parseParcel Function

**Files:**
- Modify: `src/lib/sendcloud/client.ts:82-152`

**Step 1: Add error detection to parseParcel function**

At the end of the parseParcel function, add error detection logic:

```typescript
export function parseParcel(parcel: SendcloudParcel): ParsedShipment {
  // ... existing code ...

  // Error detection based on status
  // Status IDs that indicate errors: 91, 92, 93, 1999, 2000, 2001
  const ERROR_STATUS_IDS = [91, 92, 93, 1999, 2000, 2001]
  const statusId = parcel.status?.id || null
  const hasStatusError = statusId !== null && ERROR_STATUS_IDS.includes(statusId)

  // Check for errors in raw parcel data
  const rawErrors = (parcel as Record<string, unknown>).errors as Record<string, string[]> | undefined
  const hasFieldErrors = rawErrors && Object.keys(rawErrors).length > 0

  // Combine error sources
  const has_error = hasStatusError || !!hasFieldErrors
  let error_message: string | null = null

  if (hasFieldErrors && rawErrors) {
    // Flatten error messages
    error_message = Object.entries(rawErrors)
      .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
      .join('; ')
  } else if (hasStatusError) {
    error_message = parcel.status?.message || 'Erreur Sendcloud'
  }

  return {
    // ... all existing fields ...
    has_error,
    error_message,
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/sendcloud/client.ts
git commit -m "feat: add error detection to parseParcel function"
```

---

## Task 5: Update parseIntegrationShipment Function

**Files:**
- Modify: `src/lib/sendcloud/client.ts:332-382`

**Step 1: Add error detection to parseIntegrationShipment function**

```typescript
function parseIntegrationShipment(shipment: SendcloudIntegrationShipment): ParsedShipment {
  // ... existing code ...

  // Error detection for integration shipments
  // Check order_status for error indicators
  const orderStatusId = shipment.order_status?.id?.toLowerCase() || ''
  const orderStatusMsg = shipment.order_status?.message || ''

  // Known error status IDs for integration shipments
  const hasStatusError = orderStatusId.includes('error') ||
                         orderStatusId.includes('failed') ||
                         orderStatusMsg.toLowerCase().includes('error') ||
                         orderStatusMsg.toLowerCase().includes('erreur')

  // Check for explicit errors array
  const hasFieldErrors = shipment.errors && Object.keys(shipment.errors).length > 0

  // Check for checkout payload errors
  const hasCheckoutErrors = shipment.checkout_payload_errors && shipment.checkout_payload_errors.length > 0

  // Combine error sources
  const has_error = hasStatusError || !!hasFieldErrors || !!hasCheckoutErrors
  let error_message: string | null = null

  if (hasFieldErrors && shipment.errors) {
    error_message = Object.entries(shipment.errors)
      .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
      .join('; ')
  } else if (hasCheckoutErrors && shipment.checkout_payload_errors) {
    error_message = shipment.checkout_payload_errors.join('; ')
  } else if (hasStatusError) {
    error_message = orderStatusMsg || 'Erreur de validation'
  }

  return {
    // ... all existing fields ...
    has_error,
    error_message,
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/sendcloud/client.ts
git commit -m "feat: add error detection to parseIntegrationShipment function"
```

---

## Task 6: Update Sync Route to Save Error Fields

**Files:**
- Modify: `src/app/api/sync/sendcloud/run/route.ts:150-194`

**Step 1: Add has_error and error_message to upsert**

In the upsert call, add the error fields:

```typescript
const { data: shipment, error: shipmentError } = await adminClient
  .from('shipments')
  .upsert(
    {
      // ... existing fields ...
      date_announced: parcel.date_announced,
      // Error detection fields
      has_error: parcel.has_error,
      error_message: parcel.error_message,
    },
    { onConflict: 'sendcloud_id' }
  )
  .select('id')
  .single()
```

**Step 2: Commit**

```bash
git add src/app/api/sync/sendcloud/run/route.ts
git commit -m "feat: save has_error and error_message during sync"
```

---

## Task 7: Update Shipments API to Return Error Fields

**Files:**
- Modify: `src/app/api/shipments/route.ts`

**Step 1: Add has_error and error_message to select**

Ensure the shipments API returns the error fields:

```typescript
const { data, error, count } = await db
  .from('shipments')
  .select(`
    *,
    shipment_items(
      qty,
      sku:skus(id, sku_code, name)
    )
  `, { count: 'exact' })
  // ... rest of query
```

The `*` should already include has_error and error_message.

**Step 2: Commit (if changes needed)**

```bash
git add src/app/api/shipments/route.ts
git commit -m "feat: ensure shipments API returns error fields"
```

---

## Task 8: Update ExpeditionsClient to Use Database Error Field

**Files:**
- Modify: `src/app/(dashboard)/expeditions/ExpeditionsClient.tsx`

**Step 1: Update Shipment interface**

Add the error fields to the Shipment interface:

```typescript
interface Shipment {
  // ... existing fields ...
  has_error: boolean | null
  error_message: string | null
}
```

**Step 2: Update error indicator logic**

Replace the status-based error detection with the database field:

```typescript
// Remove the ERROR_STATUS_IDS constant and isErrorStatus function
// Replace with simple database field check

// In the table cell, use:
{shipment.has_error && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{shipment.error_message || 'Erreur Sendcloud'}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/expeditions/ExpeditionsClient.tsx
git commit -m "feat: use has_error field for error indicator display"
```

---

## Task 9: Build and Test

**Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 2: Test locally**

1. Start dev server: `npm run dev`
2. Navigate to Expeditions page
3. Verify no false positives (shipments without errors should not show warning)
4. Trigger a sync to import shipments with errors
5. Verify error indicator appears only for shipments with actual errors

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues for error detection"
```

---

## Task 10: Push to Production

**Step 1: Push to main**

```bash
git push origin main
```

**Step 2: Verify Render deployment**

Check https://dashboard.render.com for deployment status

**Step 3: Run sync on production**

Trigger a sync via the app to update existing shipments with error fields

---

## Verification Checklist

1. [ ] Migration applied successfully
2. [ ] ParsedShipment type includes has_error and error_message
3. [ ] parseParcel detects errors from status IDs
4. [ ] parseIntegrationShipment detects errors from order_status and errors field
5. [ ] Sync saves has_error and error_message to database
6. [ ] ExpeditionsClient shows warning ONLY when has_error = true
7. [ ] Build succeeds
8. [ ] No false positives in production
