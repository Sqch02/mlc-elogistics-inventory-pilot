# Invoice Date Range + Preview Design

**Goal:** Replace month-only invoice generation with custom date range selector and shipment preview before generating.

**Architecture:** Add preview endpoint, modify generate to accept date_from/date_to, add preview dialog to FacturationClient.

## Files

| File | Change |
|------|--------|
| `src/app/api/invoices/preview/route.ts` | New - preview endpoint |
| `src/app/api/invoices/generate/route.ts` | Accept date_from/date_to |
| `src/hooks/useInvoices.ts` | Modify generate + add preview hook |
| `src/app/(dashboard)/facturation/FacturationClient.tsx` | Date inputs + preview dialog |

## API

### POST /api/invoices/preview
- Input: `{ date_from: "2026-01-30", date_to: "2026-02-27" }`
- Output: `{ shipment_count, returns_count, missing_pricing, estimated_total, shipments: [first 100], total_shipments }`
- Same filtering logic as generate (exclude returns, cancelled, on hold)

### POST /api/invoices/generate (modified)
- Accept `{ date_from, date_to }` instead of `{ month }`
- Backward compat: still accept `{ month }` and derive dates
- `month` field derived from date_to month

## UI
- Two date inputs (Du / Au) replacing month dropdown
- "Apercu" button loads preview dialog
- Preview dialog: stats header + scrollable shipment table + "Generer" button
- month label derived from date_to for invoice display
