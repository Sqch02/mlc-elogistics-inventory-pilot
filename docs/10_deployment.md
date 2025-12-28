# Déploiement

## Environnements
- dev local
- staging (optionnel)
- prod (Render)

## Variables d'environnement (exemples)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (backend uniquement)
- SENDCLOUD_API_KEY / SENDCLOUD_SECRET ou token
- APP_BASE_URL

## Render
- Service web frontend/backend
- Cron job pour /api/sync/sendcloud/run si nécessaire
