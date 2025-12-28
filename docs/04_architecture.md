# Architecture technique

## Stack proposée
- Frontend: React + Tailwind (ou Next.js si choisi)
- Backend API: Node (Next API routes) ou service Node/Express (à trancher)
- DB: Supabase Postgres
- Auth: Supabase Auth (email/password) ou auth custom simple si nécessaire
- Jobs: cron Render ou Supabase scheduled functions (selon préférence)

## Principes
- Idempotence: toute sync Sendcloud doit être rejouable sans doublons.
- Traçabilité: garder logs de sync et la source des données (timestamp, cursor, etc.)
- Multi-clients: V1 pilote d'abord, puis ajout en fin de V1 via "tenant_id"
  - séparation logique par tenant_id (Row Level Security côté Supabase si possible)
