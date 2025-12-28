# Contrat API (proposition)

## Auth
- Bearer token (Supabase session) ou cookie session si Next.js.

## Endpoints (exemples)
- GET /api/dashboard?month=YYYY-MM
- GET /api/skus
- POST /api/skus/import
- GET /api/stock
- POST /api/inbound
- GET /api/locations
- POST /api/locations/import
- POST /api/locations/assign
- GET /api/pricing
- POST /api/pricing/import
- POST /api/sync/sendcloud/run
- GET /api/shipments?from=...&to=...
- GET /api/invoices?month=YYYY-MM
- POST /api/invoices/generate?month=YYYY-MM
- GET /api/claims
- POST /api/claims
- PATCH /api/claims/:id

Règle: toutes requêtes filtrées par tenant_id.
