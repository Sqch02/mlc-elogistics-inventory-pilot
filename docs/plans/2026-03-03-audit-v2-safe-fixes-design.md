# Audit V2 - Safe Fixes Design

## Objectif
Corriger les 5 problemes critiques/hauts identifies lors du 2eme audit sans casser l'app en production.

## Strategie
- Branche `fix/audit-v2` depuis main
- Tag `v1.3-pre-audit-v2` comme point de rollback
- 1 fix = 1 commit, `npm run build` entre chaque
- Si build casse → `git checkout .` immediat
- Merge sur main quand tout passe

## Fixes (dans l'ordre)

### Fix 1 : Rename migration 00015 en double
- **Fichier** : `supabase/migrations/00015_add_shipment_error_fields.sql` → renommer en `00015b_add_shipment_error_fields.sql`
- **Risque** : Zero. Fichier local, deja applique en DB. Aucun impact runtime.
- **Verification** : `npm run build`

### Fix 2 : Supprimer dead code webhook (700 lignes)
- **Fichier** : `src/app/api/webhooks/sendcloud/route.ts`
- **Action** : Supprimer tout le code apres le `return NextResponse.json({ error: ... }, { status: 410 })` (lignes ~376-711). Ne garder que le POST handler qui retourne 410 + le GET handler.
- **Risque** : Zero. Code apres un return, jamais execute.
- **Verification** : `npm run build`

### Fix 3 : Ajouter RLS sur table `returns`
- **Fichier** : Nouvelle migration `supabase/migrations/00029_fix_returns_rls.sql`
- **Action** : `ALTER TABLE returns ENABLE ROW LEVEL SECURITY` + policies CRUD standard
- **Risque** : Quasi-zero. Le cron utilise `adminClient` (service role, bypass RLS). Le webhook aussi. Aucun endpoint user ne query `returns` directement via client RLS. La restriction ne bloque rien.
- **Verification** : `npm run build` + verifier que le cron sync fonctionne toujours

### Fix 4 : Renforcer validation cron secret
- **Fichier** : `src/app/api/sync/sendcloud/cron/route.ts`
- **Action** : Changer la logique pour toujours exiger le secret (pas seulement en production)
- **Risque** : Tres faible. Le secret `CRON_SECRET=mlc-cron-2024` est deja configure en prod. En dev, on peut garder un fallback si pas de secret.
- **Verification** : `npm run build`

### Fix 5 : Supprimer console.error frontend (9 instances)
- **Fichiers** : ExpeditionsFilters, FacturationActions, FacturationClient, ProduitsFilters, ProduitsClient, ReclamationsActions, ReclamationsClient, admin/users, admin/tenants
- **Action** : Remplacer `console.error(...)` par rien (les erreurs sont deja gerees via toast ou try/catch)
- **Risque** : Zero. Supprime des logs, pas de logique.
- **Verification** : `npm run build`

## Rollback
- `git checkout v1.3-pre-audit-v2` pour revenir a l'etat exact d'avant
- Chaque fix est un commit isole, revertable individuellement avec `git revert <sha>`
