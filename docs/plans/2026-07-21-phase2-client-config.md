# Phase 2 — Config clients (fournie par Quentin, 21/07/2026)

Config nécessaire pour l'activation des patterns douane (HS code) et le lot notifications email.
**Non utilisée tant que ces features ne sont pas activées** (dry-run inerte aujourd'hui).

## Codes SH (douane) par client → `tenant_settings.default_hs_code`

| Client | Code SH | État en base |
|---|---|---|
| FLORNA (O POSITIF) | `210690` | ✅ déjà posé |
| REBORN21 | `210690` | ✅ déjà posé |
| ANTEOS | `250840` | ✅ posé le 21/07 |
| MOTIJET | **deux codes** (voir ci-dessous) | ⏳ NON posé (cas particulier) |

### ⚠️ MOTIJET — cas particulier : deux marques, deux codes SH
MOTIJET regroupe deux marques avec des codes douaniers différents :
- **FACTEUR LIVRE** (livres) → `490199`
- **ATELIER BAMBOU** (accessoires bambou) → `6307.10`

Un `default_hs_code` unique **ne convient pas** pour MOTIJET. Quand le pattern « code douanier manquant » sera activé, il faudra une **logique par produit/marque** pour MOTIJET (mapper le SH selon la marque/le produit de la ligne), pas un simple défaut tenant. `default_hs_code` de MOTIJET laissé vide volontairement.

Rappel spike : aucun cas réel de HS manquant trouvé en 120 j → ce pattern reste **capacité-seule** (write désactivé jusqu'au premier cas réel), donc pas d'urgence.

## Emails de notification (lot notifications, à construire)

Aujourd'hui il n'existe **pas de colonne dédiée** (`alert_email`) dans `tenant_settings` — seulement `tenants.email` générique. À prévoir lors du lot notifications email.

**Email d'alerte / notification par client :**
- FLORNA : `contact@maisonfleursdebach.fr`
- REBORN21 : `jonathan.franke1983@gmail.com`
- MOTIJET : `contact@motijet.com`
- ANTEOS : `contact@anteos-argile.fr`

**CC équipe sur TOUTES les notifications** (arrivage, factures, etc.) : `contact@homemade-elogistics.com`

### À faire lors du lot notifications
- Ajouter une colonne `tenant_settings.notification_email` (email d'alerte par client) + peupler avec les valeurs ci-dessus.
- Prévoir un CC fixe configurable `contact@homemade-elogistics.com` sur chaque email sortant (arrivage, facture, alerte stock…).
- Rappel design : destinataires distincts possibles (facturation / stock / auto-fix / arrivages) — ici Quentin veut le même CC équipe partout, mais garder l'architecture ouverte.
