# Sécurité

## Secrets
- Ne jamais committer de tokens/keys.
- Utiliser variables d'environnement.
- Accès Supabase/Sendcloud: rotation possible.

## Multi-tenant
- tenant_id partout
- Option recommandée: Row Level Security Supabase + policies par tenant.

## Logs
- Ne pas logger les secrets
- Logger uniquement ids et erreurs anonymisées
