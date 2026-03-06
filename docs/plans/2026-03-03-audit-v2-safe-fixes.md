# Audit V2 Safe Fixes - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 critical/high audit issues without breaking production.

**Architecture:** Sequential fix-by-fix approach on a dedicated branch. Each fix is a single commit verified with `npm run build`. Git tag for instant rollback. All fixes are additive (add RLS) or subtractive (remove dead code/logs) -- none change business logic.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), TypeScript

---

### Task 0: Safety Setup

**Files:**
- None modified

**Step 1: Create git tag as rollback point**

```bash
git tag v1.3-pre-audit-v2
```

**Step 2: Create fix branch**

```bash
git checkout -b fix/audit-v2
```

**Step 3: Verify clean state**

```bash
git status
```

Expected: Clean working tree (untracked docs/ files are OK).

---

### Task 1: Fix Duplicate Migration 00015

**Files:**
- Rename: `supabase/migrations/00015_add_shipment_error_fields.sql` -> `supabase/migrations/00015b_add_shipment_error_fields.sql`

**Step 1: Rename the file**

```bash
git mv supabase/migrations/00015_add_shipment_error_fields.sql supabase/migrations/00015b_add_shipment_error_fields.sql
```

**Why this is safe:** Migration files are already applied to production DB. Renaming doesn't change DB state. The `00015b` prefix preserves ordering while resolving the duplicate.

**Step 2: Build to verify**

```bash
npm run build
```

Expected: Build succeeds (migrations aren't imported by Next.js).

**Step 3: Commit**

```bash
git add supabase/migrations/00015b_add_shipment_error_fields.sql
git commit -m "fix: Rename duplicate migration 00015 to 00015b"
```

---

### Task 2: Remove Dead Code from Deprecated Webhook

**Files:**
- Modify: `src/app/api/webhooks/sendcloud/route.ts`

**Step 1: Replace the entire file**

The file currently has 711 lines. Lines 1-374 contain:
- Imports (lines 1-9) -- most are unused after deprecation
- Interface/constant/function definitions (lines 11-366) -- all unreachable
- The POST handler that returns 410 (lines 368-374)
- Lines 376-703: Unreachable legacy code with hardcoded tenant ID
- Lines 705-711: GET handler (still needed for endpoint verification)

Replace the entire file with just the minimal POST (410) + GET handler:

```typescript
import { NextResponse } from 'next/server'

// This endpoint is deprecated. Use /api/webhooks/sendcloud/[tenantCode] instead.
export async function POST() {
  console.warn('[Webhook] Deprecated endpoint called without tenant code.')
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/webhooks/sendcloud/{TENANT_CODE}' },
    { status: 410 }
  )
}

// Sendcloud may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({
    status: 'deprecated',
    message: 'This endpoint is deprecated. Use /api/webhooks/sendcloud/{TENANT_CODE}',
  })
}
```

**Why this is safe:** The POST already returns 410 on line 374 -- everything after is dead code. The GET handler is simplified but still responds. All active webhook processing happens in `/api/webhooks/sendcloud/[tenantCode]/route.ts`.

**Step 2: Build to verify**

```bash
npm run build
```

Expected: Build succeeds. File went from 711 lines to ~16 lines.

**Step 3: Commit**

```bash
git add src/app/api/webhooks/sendcloud/route.ts
git commit -m "fix: Remove 700 lines dead code from deprecated webhook endpoint"
```

---

### Task 3: Add RLS to Returns Table

**Files:**
- Create: `supabase/migrations/00029_fix_returns_rls.sql`

**Step 1: Create migration file**

```sql
-- Fix: Enable RLS on returns table (was missing)
-- SAFE: Cron and webhook use adminClient (service_role) which bypasses RLS.
-- The returns API route uses createAdminClient() for writes and manual tenant_id filtering for reads.
-- Adding RLS is defense-in-depth; it won't break existing functionality.

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own tenant's returns
CREATE POLICY "Users can view own tenant returns" ON returns
  FOR SELECT USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());

-- Allow users to update their own tenant's returns (for restock actions)
CREATE POLICY "Users can update own tenant returns" ON returns
  FOR UPDATE USING (tenant_id = public.get_tenant_id() OR public.is_super_admin());

-- INSERT and DELETE are admin-only (via service_role from cron/webhook)
-- No user-facing INSERT/DELETE policies needed
```

**Why this is safe:**
- The cron sync (`/api/sync/sendcloud/cron/route.ts`) uses `getAdminDb()` which is the service_role client. Service role bypasses ALL RLS policies.
- The webhook (`/api/webhooks/sendcloud/[tenantCode]/route.ts`) also uses `getAdminDb()`.
- The returns API route (`/api/returns/route.ts`) uses `createAdminClient()` for writes. For GET, it manually filters by `tenant_id` already.
- Adding RLS just adds defense-in-depth without affecting any existing code path.

**Step 2: Apply migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool to execute this SQL.

**Step 3: Build to verify**

```bash
npm run build
```

Expected: Build succeeds (migrations are not bundled by Next.js).

**Step 4: Commit**

```bash
git add supabase/migrations/00029_fix_returns_rls.sql
git commit -m "fix: Add missing RLS policies on returns table"
```

---

### Task 4: Strengthen Cron Secret Validation

**Files:**
- Modify: `src/app/api/sync/sendcloud/cron/route.ts:24-35`

**Step 1: Replace the cron secret validation block**

Current code (lines 24-35):
```typescript
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.error('[Cron] CRON_SECRET not configured in production')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

New code:
```typescript
  // Verify cron secret - ALWAYS required
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

**Why this is safe:**
- Production already has `CRON_SECRET=mlc-cron-2024` configured on Render.
- The change makes validation unconditional instead of only in production.
- Dev environments need to add `CRON_SECRET` to `.env.local` (minor, documented).
- If `CRON_SECRET` is missing, the endpoint returns 500 instead of silently accepting all requests.

**Step 2: Build to verify**

```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/sync/sendcloud/cron/route.ts
git commit -m "fix: Always require CRON_SECRET for sync endpoint"
```

---

### Task 5: Remove Frontend console.error Statements

**Files (13 occurrences across 9 files):**
- Modify: `src/app/(dashboard)/expeditions/ExpeditionsFilters.tsx:86`
- Modify: `src/app/(dashboard)/facturation/FacturationActions.tsx:123,292,325,349`
- Modify: `src/app/(dashboard)/facturation/FacturationClient.tsx:220`
- Modify: `src/app/(dashboard)/produits/ProduitsFilters.tsx:53`
- Modify: `src/app/(dashboard)/produits/ProduitsClient.tsx:267`
- Modify: `src/app/(dashboard)/reclamations/ReclamationsActions.tsx:126`
- Modify: `src/app/(dashboard)/reclamations/ReclamationsClient.tsx:355`
- Modify: `src/app/(admin)/admin/users/page.tsx:47`
- Modify: `src/app/(admin)/admin/tenants/page.tsx:56,84`

**Step 1: Remove each console.error line**

For each file, delete the `console.error(...)` line. All are inside `catch` blocks that already handle the error (via `try/catch`, toast, or `setLoading(false)`). The `console.error` adds nothing except noise in production.

Exact lines to delete:

| File | Line | Content |
|------|------|---------|
| `ExpeditionsFilters.tsx` | 86 | `console.error('Export error:', error)` |
| `FacturationActions.tsx` | 123 | `console.error('Error updating status:', err)` |
| `FacturationActions.tsx` | 292 | `console.error('Export error:', error)` |
| `FacturationActions.tsx` | 325 | `console.error('Export error:', error)` |
| `FacturationActions.tsx` | 349 | `console.error('Export error:', error)` |
| `FacturationClient.tsx` | 220 | `console.error('Export error:', error)` |
| `ProduitsFilters.tsx` | 53 | `console.error('Export error:', error)` |
| `ProduitsClient.tsx` | 267 | `console.error('Error fetching volume:', error)` |
| `ReclamationsActions.tsx` | 126 | `console.error('Error updating claim:', err)` |
| `ReclamationsClient.tsx` | 355 | `console.error('Sync error:', error)` |
| `admin/users/page.tsx` | 47 | `console.error('Error fetching users:', error)` |
| `admin/tenants/page.tsx` | 56 | `console.error('Error fetching tenants:', error)` |
| `admin/tenants/page.tsx` | 84 | `console.error('Error creating tenant:', error)` |

**Why this is safe:** Every instance is inside a `catch` block where the error is already handled by:
- Setting loading state to false
- Showing a toast notification
- The catch block continues execution normally

Removing `console.error` only removes browser console output. No logic changes.

**Step 2: Build to verify**

```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: Remove 13 console.error statements from frontend"
```

---

### Task 6: Merge and Push

**Step 1: Switch to main and merge**

```bash
git checkout main
git merge fix/audit-v2
```

**Step 2: Final build verification**

```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Push**

```bash
git push origin main
```

**Step 4: Clean up branch**

```bash
git branch -d fix/audit-v2
```

---

## Verification Checklist

After all fixes:
- [ ] `npm run build` passes
- [ ] Git tag `v1.3-pre-audit-v2` exists for rollback
- [ ] No duplicate migration numbers
- [ ] No dead code in webhook route (file < 20 lines)
- [ ] RLS enabled on `returns` table
- [ ] Cron secret always validated
- [ ] Zero `console.error` in frontend `.tsx` files
- [ ] Cron sync still works (check Render logs after deploy)
- [ ] Webhook still works for FLORNA and ANTEOS
