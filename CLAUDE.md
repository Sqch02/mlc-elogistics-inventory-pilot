# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build (also runs TypeScript check)
npm run lint     # Run ESLint
npm start        # Start production server
```

## Database Migrations

Migrations are in `supabase/migrations/` (numbered 00001-00014). Apply via:
- Supabase MCP: `apply_migration` tool
- Supabase CLI: `supabase db push`
- Manual: Execute SQL files in order in Supabase SQL Editor

## Architecture Overview

### Multi-Tenant 3PL Inventory System

This is a logistics management app for MLC PROJECT (a 3PL company). Core domain:
- **Shipments** synced from Sendcloud API
- **SKUs/Products** with stock tracking and alert thresholds
- **Bundles (BOM)** - kits that decompose into component SKUs
- **Pricing rules** - carrier + weight bracket → price
- **Monthly invoicing** - aggregate shipment costs
- **Claims** - SAV workflow for damaged/lost shipments

### Route Groups (Next.js App Router)

- `(auth)/` - Public routes (login page)
- `(dashboard)/` - Protected routes with sidebar layout
- `(admin)/` - Super-admin only (tenant/user management)
- `api/` - REST endpoints

### Key Patterns

**Authentication Flow:**
- Middleware (`src/middleware.ts`) protects routes and checks roles
- `src/lib/supabase/auth.ts` provides `getCurrentUser()`, `requireAuth()`, `requireRole()`
- User profiles linked to `tenant_id` for data isolation

**RLS (Row Level Security):**
- All tables filtered by `tenant_id`
- `public.get_tenant_id()` function retrieves tenant from user profile
- `public.get_my_profile()` RPC bypasses RLS for auth bootstrap

**Sendcloud Integration:**
- Real client: `src/lib/sendcloud/client.ts`
- Mock for dev: `src/lib/sendcloud/mock.ts` (when `SENDCLOUD_USE_MOCK=true`)
- Sync is idempotent using `sendcloud_id` as unique key
- **Webhook endpoint**: `/api/webhooks/sendcloud` for real-time parcel updates
- **Cron sync**: Every 15 min via `/api/sync/sendcloud/cron` (fallback)

**CSV Import:**
- Upload component: `src/components/forms/UploadCSV.tsx`
- Validation schemas: `src/lib/validations/import.ts` (Zod)
- API routes: `/api/import/{skus,bundles,pricing,locations,restock,shipment-items}`

### Database Schema (Main Tables)

```
tenants → profiles (users)
       → skus → stock_snapshots
             → bundles → bundle_components
             → location_assignments ← locations
       → shipments → shipment_items
       → pricing_rules
       → invoices_monthly → invoice_lines
       → claims
       → sync_runs
```

### Business Rules

- **Pricing**: Weight in grams, brackets are `min <= weight < max`
- **Stock consumption**: Calculated from `shipment_items`, bundles auto-decompose
- **Missing pricing**: Shipments flagged as `pricing_status='missing'`, isolated on invoice
- **Locations**: 1 SKU per location maximum (no qty tracking in V1)

## Design System (Modern Logistics ERP)

**Color Palette:**
- Primary: `#1F7A5A` (Emerald Green)
- Secondary: `#008080` (Teal)
- Background: `#F6F7F9` (Light blue-gray)
- Surface/Cards: `#FFFFFF`
- Semantic: Success `#16A34A`, Warning `#F59E0B`, Error `#DC2626`

**Typography:** Inter font, titles semibold, body 14px, labels 12px muted

**Layout:**
- Sidebar: Fixed 260px, white, active state = light green bg + left border
- Content: Centered max-w-[1280px], 24px padding
- Cards: 16px radius, subtle shadow

**Badge Variants:** `success`, `warning`, `error`, `info`, `muted` (pill style)

**Dashboard Components** (in `src/components/dashboard/`):
- `DashboardKpiCard` - KPI with sparkline (Recharts AreaChart)
- `ShipmentsChart` - Daily bar chart (Recharts BarChart)
- `StockHealthPanel` - Progress bars for stock days remaining
- `AlertsPanel` - Actionable alerts list
- `BillingWidget` - Monthly billing status

**Page Template Pattern:**
```tsx
<div className="space-y-6">
  {/* Header: H1 + subtitle + action buttons */}
  {/* Filters: Search + pills in white Card */}
  {/* Content: Table or Card grid */}
</div>
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SENDCLOUD_USE_MOCK=true  # Set false in production with real API keys
```

Optional:
```
SUPABASE_SERVICE_ROLE_KEY=  # For admin operations
SENDCLOUD_API_KEY=
SENDCLOUD_SECRET=
SENDCLOUD_WEBHOOK_SECRET=   # For real-time webhook validation
```

## Sendcloud Webhook Setup (Real-time Sync)

To enable real-time parcel updates from Sendcloud:

1. **Get your webhook URL**: `https://mlc-inventory.onrender.com/api/webhooks/sendcloud`

2. **Configure in Sendcloud Panel**:
   - Go to Settings > Integrations > Webhooks
   - Enable "Webhook Feedback"
   - Paste your webhook URL
   - Select events: `parcel_status_changed`, `parcel_created`
   - Copy the webhook secret

3. **Add the secret to Render dashboard**:
   - Go to your Render service > Environment
   - Add `SENDCLOUD_WEBHOOK_SECRET` with the value from Sendcloud

4. **Verify it works**:
   - Create a test shipment in Sendcloud
   - Check your app logs for `[Webhook] Processed parcel: ...`

The webhook automatically:
- Validates signatures (HMAC-SHA256)
- Upserts shipments using `sendcloud_id` (idempotent)
- Calculates pricing from `pricing_rules`
- Links `shipment_items` to SKUs
