# URL-Based Tenant Routing - Design Document

**Statut** : A implementer apres le plan Aurelien
**Objectif** : Remplacer le systeme cookie-only par des URLs qui incluent le tenant actif

## Problemes actuels (cookie-only)

1. L'URL est identique sur MLC hub et Florna (`/expeditions` pour les deux)
2. Impossible d'avoir 2 onglets sur 2 tenants differents (meme cookie)
3. URLs non-partageables (le lien ne contient pas le contexte tenant)
4. Pas de browser history par tenant (back/forward ne change pas de tenant)

## Solution : Segment dynamique `/t/[tenantCode]/`

### Structure des routes

```
AVANT:                          APRES:
/                               /t/mlc/           (hub dashboard)
/expeditions                    /t/florna/expeditions
/produits                       /t/florna/produits
/analytics                      /t/florna/analytics
/admin                          /admin             (reste global)
/login                          /login             (reste global)
```

### Migration des fichiers

```
AVANT:
src/app/(dashboard)/
  layout.tsx
  page.tsx                      # Dashboard
  expeditions/page.tsx
  produits/page.tsx
  ...

APRES:
src/app/(dashboard)/t/[tenantCode]/
  layout.tsx                    # Lit tenantCode depuis params
  page.tsx                      # Dashboard (hub ou client selon code)
  expeditions/page.tsx
  produits/page.tsx
  ...
```

### Changements par composant

**1. Layout `(dashboard)/t/[tenantCode]/layout.tsx`**
- Recoit `params.tenantCode` du segment dynamique
- Valide que le code tenant existe en base
- Verifie que le super_admin a le droit d'acceder a ce tenant
- Passe le `tenantCode` au TenantProvider (plus besoin de cookie)

**2. TenantProvider**
- Recoit `tenantCode` en prop au lieu de lire le cookie
- `setActiveTenantId()` fait `router.push('/t/${newCode}/${currentPath}')` au lieu de `window.location.reload()`
- Plus de cookie `mlc_active_tenant` (ou le garder en fallback pour la redirect initiale)

**3. Sidebar / Links**
- Tous les `<Link href="/expeditions">` deviennent `<Link href={/t/${tenantCode}/expeditions}>`
- Creer un hook `useTenantLink(path)` qui prefixe automatiquement
- Ou un composant `<TenantLink href="/expeditions">` wrapper

**4. Middleware**
- Valide le `[tenantCode]` existe
- Redirige `/` vers `/t/mlc/` pour super_admin ou `/t/{userTenantCode}/` pour les autres
- Bloque l'acces a un tenant non-autorise

**5. API Routes**
- Option A : Garder le cookie (API ne change pas)
- Option B : Passer le tenantCode en query param ou header
- Recommandation : Option A pour minimiser les changements backend

**6. Header / Tenant Switcher**
- Le dropdown switch vers `router.push('/t/${newCode}/')` au lieu de reload
- Transition fluide sans rechargement complet

### Points d'attention

- Redirect legacy URLs (`/expeditions` → `/t/{code}/expeditions`)
- Le cookie peut servir de "dernier tenant visite" pour la redirect initiale
- Les routes `/admin` et `/login` restent HORS du segment `/t/[tenantCode]/`
- Les utilisateurs non-super_admin sont rediriges automatiquement vers leur tenant

### Estimation

- ~50 fichiers a modifier
- ~2-3 jours de travail
- Risque modere (refactoring structurel, pas de nouvelle logique metier)
