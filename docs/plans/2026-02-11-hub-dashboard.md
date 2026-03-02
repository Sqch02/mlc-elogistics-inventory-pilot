# Hub Dashboard Multi-Client - Plan d'implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Quand le super_admin est sur le tenant MLC (son tenant d'origine), afficher un dashboard hub avec une vue agregee de tous les clients au lieu d'un dashboard vide.

**Architecture:** Approche 100% additive - aucun code existant n'est modifie de maniere destructive. On ajoute un flag `isHubView` au TenantProvider, une nouvelle API `/api/hub/dashboard`, et un nouveau composant `HubDashboard`. Le `DashboardV2` existant ajoute UN seul `if` pour afficher le hub quand on est sur le tenant MLC. Tout le reste (switch tenant, vues client, APIs existantes) reste strictement inchange.

**Tech Stack:** Next.js App Router, React Query, Supabase admin client (bypass RLS), Recharts, Framer Motion, shadcn/ui

**Securite:** Le hub n'est accessible que par super_admin sur son propre tenant. Detection : `isSuperAdmin && activeTenantId === userTenantId` (pas de hardcoding d'ID).

---

## Detection du Hub View

La detection repose sur une logique simple dans `TenantProvider.tsx` :
- Le super_admin a son profil rattache au tenant MLC (`userTenantId` prop)
- Quand il est sur MLC (pas de switch), `activeTenantId === userTenantId`
- Quand il switch vers Florna, `activeTenantId !== userTenantId`
- Donc : `isHubView = isSuperAdmin && activeTenantId === userTenantId`

Aucun ID n'est hardcode. Si demain le super_admin change de tenant d'origine, ca continue de marcher.

---

## Task 1 : Ajouter `isHubView` au TenantProvider

**Files:**
- Modify: `src/components/providers/TenantProvider.tsx`

**Step 1: Ajouter isHubView a l'interface et au contexte**

Dans `TenantContextType`, ajouter :
```typescript
interface TenantContextType {
  // ... existant inchange ...
  isHubView: boolean  // <-- AJOUT
}
```

Dans le composant `TenantProvider`, calculer le flag :
```typescript
const isHubView = isSuperAdmin && activeTenantId === userTenantId
```

Ajouter `isHubView` dans la `value` du Provider :
```typescript
value={{
  // ... existant inchange ...
  isHubView,
}}
```

**Verification :** `npm run build` doit passer. Aucune page ne consomme encore `isHubView`, donc zero impact.

**Step 2: Commit**
```
feat: Ajouter isHubView au TenantProvider
```

---

## Task 2 : Creer l'API Hub Dashboard

**Files:**
- Create: `src/app/api/hub/dashboard/route.ts`

**Step 1: Creer le endpoint**

L'API hub fait :
1. Verifier que l'utilisateur est `super_admin` (sinon 403)
2. Lister tous les tenants actifs (sauf le tenant MLC du super_admin)
3. Pour chaque tenant, recuperer les KPIs du mois en cours :
   - Nombre d'expeditions
   - Cout transport total
   - Nombre de tarifs manquants
   - Nombre de SKUs critiques (stock < 20)
   - Statut sync (derniere sync_run)
4. Calculer les totaux agreges
5. Retourner le tout

```typescript
// src/app/api/hub/dashboard/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFastUser } from '@/lib/supabase/fast-auth'

export async function GET() {
  try {
    const user = await getFastUser()
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const db = createAdminClient()

    // Get all active tenants except the super_admin's own (hub) tenant
    const { data: tenants } = await db
      .from('tenants')
      .select('id, name, code, is_active')
      .eq('is_active', true)
      .neq('id', user.tenant_id)
      .order('name')

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ tenants: [], totals: { shipments: 0, cost: 0, missingPricing: 0, criticalStock: 0 } })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    // Fetch per-tenant metrics in parallel
    const tenantMetrics = await Promise.all(
      tenants.map(async (tenant) => {
        const [shipmentsRes, costRes, missingRes, stockRes, syncRes] = await Promise.all([
          // Shipments count this month
          db.from('shipments')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .gte('shipped_at', startOfMonth)
            .lte('shipped_at', endOfMonth),

          // Total cost this month
          db.from('shipments')
            .select('computed_cost_eur')
            .eq('tenant_id', tenant.id)
            .eq('pricing_status', 'ok')
            .gte('shipped_at', startOfMonth)
            .lte('shipped_at', endOfMonth),

          // Missing pricing count (total, not just this month)
          db.from('shipments')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('pricing_status', 'missing'),

          // Critical stock (qty < 20, excluding bundles)
          db.from('stock_snapshots')
            .select('qty_current, sku_id, skus(sku_code)')
            .eq('tenant_id', tenant.id)
            .lt('qty_current', 20),

          // Last sync
          db.from('sync_runs')
            .select('ended_at, status')
            .eq('tenant_id', tenant.id)
            .eq('source', 'sendcloud')
            .order('ended_at', { ascending: false })
            .limit(1),
        ])

        const costData = costRes.data as { computed_cost_eur: number | null }[] | null
        const totalCost = costData?.reduce((sum, s) => sum + (Number(s.computed_cost_eur) || 0), 0) || 0

        // Filter out bundles from critical stock
        const criticalStock = (stockRes.data || []).filter((s: any) => {
          const code = s.skus?.sku_code || ''
          return !code.toUpperCase().includes('BU-')
        }).length

        const lastSync = syncRes.data?.[0] || null

        return {
          id: tenant.id,
          name: tenant.name,
          code: tenant.code,
          shipments: shipmentsRes.count || 0,
          cost: totalCost,
          missingPricing: missingRes.count || 0,
          criticalStock,
          lastSync: lastSync ? {
            date: lastSync.ended_at,
            status: lastSync.status,
          } : null,
        }
      })
    )

    // Aggregate totals
    const totals = tenantMetrics.reduce(
      (acc, t) => ({
        shipments: acc.shipments + t.shipments,
        cost: acc.cost + t.cost,
        missingPricing: acc.missingPricing + t.missingPricing,
        criticalStock: acc.criticalStock + t.criticalStock,
      }),
      { shipments: 0, cost: 0, missingPricing: 0, criticalStock: 0 }
    )

    return NextResponse.json({
      tenants: tenantMetrics,
      totals,
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' }
    })
  } catch (error) {
    console.error('Hub dashboard error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
```

**Verification :** `npm run build` passe. Endpoint accessible uniquement par super_admin.

**Step 2: Commit**
```
feat: Ajouter API hub dashboard multi-client
```

---

## Task 3 : Creer le hook useHubDashboard

**Files:**
- Create: `src/hooks/useHubDashboard.ts`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

export interface HubTenantMetrics {
  id: string
  name: string
  code: string | null
  shipments: number
  cost: number
  missingPricing: number
  criticalStock: number
  lastSync: { date: string; status: string } | null
}

export interface HubDashboardData {
  tenants: HubTenantMetrics[]
  totals: {
    shipments: number
    cost: number
    missingPricing: number
    criticalStock: number
  }
  month: string
}

async function fetchHubDashboard(): Promise<HubDashboardData> {
  const response = await fetch('/api/hub/dashboard')
  if (!response.ok) throw new Error('Failed to fetch hub dashboard')
  return response.json()
}

export function useHubDashboard() {
  return useQuery({
    queryKey: ['hub-dashboard'],
    queryFn: fetchHubDashboard,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
```

**Verification :** `npm run build` passe.

**Step 3: Commit**
```
feat: Ajouter hook useHubDashboard
```

---

## Task 4 : Creer le composant HubDashboard

**Files:**
- Create: `src/components/dashboard-v2/HubDashboard.tsx`

**Design :**
- Header "Hub Operations" avec le mois en cours
- 4 KPI cards agreges (total expeditions, cout total, tarifs manquants, stock critique)
- Table des clients avec colonnes : Client, Expeditions, Cout, Tarifs manquants, Stock critique, Derniere sync
- Chaque ligne cliquable → switch vers le tenant du client (reutilise `setActiveTenantId`)
- Style coherent avec le design system existant (cards, badges, couleurs)

```typescript
// Composant utilisant :
// - useHubDashboard() pour les donnees
// - useTenant() pour setActiveTenantId (switch vers un client)
// - SecondaryKpiCard pour les KPIs agreges
// - Table shadcn/ui pour la liste des clients
// - Badge pour les statuts (sync OK/KO, alertes)
// - motion de framer-motion pour les animations
```

**Colonnes de la table clients :**
| Colonne | Description |
|---------|-------------|
| Client | Nom + code badge |
| Expeditions | Nombre ce mois |
| Cout transport | Total EUR ce mois |
| Tarifs manquants | Badge warning si > 0 |
| Stock critique | Badge danger si > 0 |
| Sync | Badge vert/rouge + date relative |
| Action | Bouton "Voir" → switch tenant |

**Verification :** `npm run build` passe.

**Step 4: Commit**
```
feat: Ajouter composant HubDashboard multi-client
```

---

## Task 5 : Brancher le Hub dans DashboardV2

**Files:**
- Modify: `src/components/dashboard-v2/DashboardV2.tsx`

**Step 1: Ajouter le conditional render**

C'est LE SEUL changement dans le code existant. Au tout debut du composant :

```typescript
export function DashboardV2() {
  const { isClient, isHubView } = useTenant()  // <-- ajouter isHubView

  // Si on est en mode hub, afficher le hub dashboard
  if (isHubView) {
    return <HubDashboard />
  }

  // ... tout le reste du code existant INCHANGE ...
}
```

Import en haut du fichier :
```typescript
import { HubDashboard } from './HubDashboard'
```

**IMPORTANT :** Le `if (isHubView)` est AVANT le `useState` et les hooks. Il faut donc le placer APRES les hooks (les hooks React ne peuvent pas etre conditionnels). Solution :

```typescript
export function DashboardV2() {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const { data, isLoading, isRefetching } = useDashboard(selectedMonth)
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalytics()
  const { isClient, isHubView } = useTenant()

  // Hub view - render hub dashboard instead
  if (isHubView) {
    return <HubDashboard />
  }

  // ... reste inchange ...
}
```

Les hooks du dashboard normal s'executent mais ne servent a rien en mode hub. C'est acceptable car :
- Le dashboard MLC retourne des donnees vides (0 expeditions, 0 stock) donc les requetes sont ultra rapides
- C'est plus sur que de conditionner les hooks (interdit par React)

**Verification :** `npm run build` passe. Tester :
1. Login super_admin sur MLC → Hub dashboard s'affiche
2. Switch vers Florna → Dashboard normal Florna s'affiche
3. Login client Florna → Dashboard normal client s'affiche (jamais de hub)

**Step 2: Commit**
```
feat: Afficher le hub dashboard quand super_admin est sur son tenant
```

---

## Resume des fichiers touches

| Fichier | Action | Risque |
|---------|--------|--------|
| `src/components/providers/TenantProvider.tsx` | MODIFY : +3 lignes (isHubView) | Tres faible - ajout pur |
| `src/app/api/hub/dashboard/route.ts` | CREATE | Zero - nouveau fichier |
| `src/hooks/useHubDashboard.ts` | CREATE | Zero - nouveau fichier |
| `src/components/dashboard-v2/HubDashboard.tsx` | CREATE | Zero - nouveau fichier |
| `src/components/dashboard-v2/DashboardV2.tsx` | MODIFY : +3 lignes (import + if) | Tres faible - early return |

**Total :** 3 fichiers crees, 2 fichiers modifies (6 lignes ajoutees au total dans l'existant).
