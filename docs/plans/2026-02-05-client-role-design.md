# Vue Client (Role Marque) - Design

Date: 2026-02-05
Statut: Implemente

## Contexte

MLC PROJECT est un 3PL qui gere la logistique pour plusieurs marques (Florna, etc.). Chaque marque doit pouvoir se connecter et voir ses propres donnees sans acceder aux fonctions admin.

## Architecture des roles

| Role | Description | Acces |
|------|-------------|-------|
| super_admin | Administrateur global | Tout + switch tenant |
| admin | Admin d'un tenant | Tout dans son tenant |
| ops | Operations | Tout sauf admin |
| sav | Service client | Tout sauf admin |
| client | Marque cliente | Vue limitee |

## Menus par role

**Roles MLC (super_admin, admin, ops, sav) :**
- Dashboard
- Analytics
- Expeditions
- Retours
- Produits & Stock
- Bundles
- Emplacements
- Pricing
- Facturation
- Reclamations
- Parametres

**Role client (marques) :**
- Dashboard
- Expeditions
- Retours
- Produits & Stock
- Bundles
- Reclamations

**Menus masques pour clients :**
- Analytics (stats internes MLC)
- Emplacements (gestion entrepot)
- Pricing (tarifs internes)
- Facturation (MLC facture les clients)
- Parametres (config admin)

## Implementation

### Migration SQL (00021)
- Ajout de 'client' a l'enum user_role
- Creation du tenant Florna (ID: f1073a00-0000-4000-a000-000000000001)

### Sidebar.tsx
- Liste des menus masques pour clients : clientHiddenMenus
- Filtrage dans SidebarContent selon userRole
- Prop userRole ajoutee a Sidebar

### Layout.tsx
- Passe userRole au composant Sidebar

## Securite

Le systeme multi-tenant existant assure deja :
- RLS sur toutes les tables filtrant par tenant_id
- Middleware verifiant l'authentification
- Separation des donnees par tenant

## Prochaines etapes

1. Obtenir l'email de Lena (Florna)
2. Creer son compte utilisateur avec role 'client' et tenant Florna
3. Tester la vue client en RDV lundi 11h30
