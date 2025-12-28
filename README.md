# MLC E-Logistics Inventory Pilot

Application de gestion d'inventaire pour MLC PROJECT (3PL) - Centralisation des donnees logistiques Sendcloud, gestion des stocks, facturation et reclamations.

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript |
| Base de donnees | Supabase (Postgres) |
| Styling | Tailwind CSS + shadcn/ui |
| Tables | TanStack Table |
| Hebergement | Render |

## Fonctionnalites

- **Sync Sendcloud** - Synchronisation idempotente des expeditions
- **Gestion SKUs** - Produits avec stock, alertes seuil critique
- **Bundles (BOM)** - Nomenclature des kits avec decomposition
- **Emplacements** - Mapping 1 SKU par emplacement
- **Pricing** - Grille tarifaire par transporteur et tranche de poids
- **Facturation** - Generation mensuelle avec export CSV
- **Reclamations** - Workflow SAV avec indemnisation
- **Multi-tenant** - Isolation par tenant_id avec RLS

## Installation Locale

### Prerequis

- Node.js 18+
- npm ou pnpm
- Compte Supabase (gratuit)
- (Optionnel) Compte Sendcloud

### 1. Cloner le projet

```bash
git clone <repo-url>
cd mlc-elogistics-inventory-pilot
npm install
```

### 2. Configuration Supabase

1. Creer un projet sur [supabase.com](https://supabase.com)
2. Recuperer les cles API dans Settings > API

### 3. Variables d'environnement

Copier `.env.example` vers `.env.local`:

```bash
cp .env.example .env.local
```

Remplir les valeurs:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Sendcloud (optionnel, mode mock par defaut)
SENDCLOUD_API_KEY=
SENDCLOUD_SECRET=
SENDCLOUD_USE_MOCK=true
```

### 4. Migrations Base de Donnees

Executer les migrations SQL dans Supabase SQL Editor, dans l'ordre:

```
supabase/migrations/00001_create_tenants.sql
supabase/migrations/00002_create_users.sql
supabase/migrations/00003_create_skus.sql
...
supabase/migrations/00014_add_super_admin_role.sql
```

Ou via Supabase CLI:

```bash
supabase db push
```

### 5. Seed Donnees de Test

Executer le seed dans Supabase SQL Editor:

```bash
supabase/seed/seed.sql
```

### 6. Lancer le serveur de dev

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

**Credentials de test:**
- Email: `admin@mlc.fr`
- Password: `password123`

## Deploiement sur Render

### 1. Creer les services

Le fichier `render.yaml` configure automatiquement:
- **mlc-inventory** - Application web Next.js
- **mlc-sync-sendcloud** - Job cron quotidien (6h UTC)

### 2. Variables d'environnement Render

Configurer dans le dashboard Render:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Cle service (secret) |
| `SENDCLOUD_API_KEY` | Cle API Sendcloud |
| `SENDCLOUD_SECRET` | Secret Sendcloud |
| `SENDCLOUD_USE_MOCK` | `false` en production |

### 3. Deployer

```bash
# Via Render Blueprint
render blueprint apply
```

Ou connecter le repo GitHub dans le dashboard Render.

## API Endpoints

### Authentification

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/auth/callback` | GET | Callback OAuth |

### Donnees

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/stock` | GET | Liste SKUs avec metriques stock |
| `/api/shipments` | GET | Liste expeditions (filtres: from, to, carrier, pricing_status) |
| `/api/bundles` | GET | Liste bundles avec composants |
| `/api/locations` | GET | Liste emplacements |
| `/api/pricing` | GET | Grille tarifaire |
| `/api/claims` | GET/POST | CRUD reclamations |
| `/api/claims/[id]` | PATCH | Mise a jour reclamation |
| `/api/invoices` | GET | Liste factures (filtre: month) |
| `/api/invoices/generate` | POST | Generer facture mensuelle |

### Import CSV

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/import/skus` | POST | Import SKUs + stock initial |
| `/api/import/bundles` | POST | Import BOM |
| `/api/import/pricing` | POST | Import grille tarifaire |
| `/api/import/locations` | POST | Import emplacements |
| `/api/import/shipment-items` | POST | Import items expedition (fallback) |
| `/api/import/restock` | POST | Import reapprovisionnements |

### Synchronisation

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/sync/sendcloud/run` | POST | Lancer sync Sendcloud |
| `/api/sync/runs` | GET | Historique des syncs |

### Systeme

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/health` | GET | Health check |

## Formats CSV Import

### SKUs (skus.csv)

```csv
sku_code,name,alert_threshold
SKU001,Produit A,50
SKU002,Produit B,100
```

### Bundles (bundles.csv)

```csv
bundle_sku_code,component_sku_code,qty_component
BUNDLE001,SKU001,2
BUNDLE001,SKU002,1
```

### Pricing (pricing.csv)

```csv
carrier,weight_min_grams,weight_max_grams,price_eur
colissimo,0,500,4.50
colissimo,500,1000,6.20
chronopost,0,500,8.00
```

### Emplacements (locations.csv)

```csv
code,label,sku_code
A-01-01,Allee A Etagere 1,SKU001
A-01-02,Allee A Etagere 2,
```

### Stock Initial (stock.csv)

```csv
sku_code,qty_available
SKU001,150
SKU002,80
```

## Regles Metier

### Pricing

- **Poids:** Toujours en grammes (poids label Sendcloud)
- **Tranches:** min inclusif, max exclusif (`min <= poids < max`)
- **Tarif manquant:** Expedition isolee sur facture, non incluse dans total

### Stock

- **Consommation:** Calculee depuis shipment_items
- **Bundles:** Decomposition automatique via bundle_components
- **Projection:** Stock actuel - consommation prevue + reappros

### Emplacements

- 1 SKU par emplacement maximum
- Pas de quantite par emplacement (V1)

## Structure du Projet

```
src/
  app/
    (auth)/         # Pages publiques (login)
    (dashboard)/    # Pages protegees
    api/            # API Routes
  components/
    ui/             # shadcn/ui
    layout/         # Sidebar, Header
    tables/         # DataTable
    forms/          # UploadCSV
    dashboard/      # KPICard, AlertCard
  lib/
    supabase/       # Clients Supabase
    sendcloud/      # Client + Mock
    utils/          # Helpers (csv, stock, pricing)
    validations/    # Schemas Zod
  types/            # Types TypeScript
supabase/
  migrations/       # SQL migrations
  seed/             # Donnees de test
scripts/
  cron-sync.ts      # Job sync Sendcloud
```

## Tests d'Acceptation

Checklist manuelle avant mise en production:

- [ ] Import SKUs/stock sans erreur
- [ ] Import BOM, decomposition correcte
- [ ] Sync Sendcloud idempotent (pas de doublon)
- [ ] Pricing: match tranches (min<=poids<max)
- [ ] Pricing: tarif manquant isole
- [ ] Facture: generation + export CSV
- [ ] Reclamation: workflow complet
- [ ] Emplacements: contrainte 1 SKU respectee

## Support

Pour toute question, contacter l'equipe MLC PROJECT.
