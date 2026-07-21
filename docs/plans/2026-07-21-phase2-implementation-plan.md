# Phase 2 — Plan d'implémentation (validé 21/07/2026)

Base : design doc `2026-05-21-auto-fix-sendcloud-errors-design.md` (architecture, patterns 1-5).
Ce plan **étend** ce périmètre avec ce qui a été ajouté/validé depuis (Quentin + Aurélien) :
pattern 6 (point relais), notifications email, gestion des comptes clients admin.
Devis signé DEV-013, 1 200 € HT, acompte 600 € en cours. **Dev démarre à réception de l'acompte.**

## Périmètre final (6 lignes du devis)

1. Moteur d'auto-correction — 6 patterns : CHF, adresse trop longue, code douanier, poids trop bas, "Announcement failed 1002", **point relais non sélectionné (nouveau)**.
2. Tableau de bord des corrections.
3. Alertes au seuil + mode simulation (dry_run).
4. Réinitialisation autonome des mots de passe client (SMTP).
5. Gestion des comptes clients côté admin.
6. Notifications email : factures au client, alerte stock, notif arrivage à l'équipe.

## À récupérer AVANT de démarrer (bloquant)

- **Code douanier (HS) par défaut** par client (Florna, REBORN21, ANTEOS, Motijet) → pattern 3.
- **Email d'alerte** par client → alertes + notifications.
- **Choix du fournisseur SMTP** (Resend recommandé, simple + gratuit au démarrage) + création de la clé API → lots 4/5/6.
- Vérifier au démarrage : `tenant_settings.shopify_api_token` existe-t-il ? (pattern 3 HS code lit Shopify via variant_id).

## Découpage en lots (ordre d'implémentation)

### Lot 0 — Fondations (0,5 j)
- Migrations : `auto_fixes` (+ index + RLS), `exchange_rates_cache`, `tenant_customs_settings`, colonnes `auto_fix_attempts`/`last_attempt` sur shipments, `auto_fix_state` (cooldown alertes).
- Squelette module `src/lib/auto-fix/` (types.ts, index.ts vides). Toggle `AUTO_FIX_ENABLED` + toggle par tenant.
- **Mode dry_run par défaut** dès le départ (rien n'est écrit chez Sendcloud tant que non activé).

### Lot 1 — Moteur + 6 patterns (2,5 j)
- `detect.ts` : matching par regex → FixPlan.
- `fixes/currency.ts` (CHF→EUR via `exchange-rate.ts`, cache 24h, fallback BCE), `address.ts`, `customs.ts` (HS + origin), `weight.ts`, **`servicepoint.ts` (nouveau : appel API Service Points Sendcloud autour du code postal du destinataire → sélection du plus proche → `to_service_point`)**.
- Pattern 5 (1002) : re-détection patterns 1-4 puis cancel + recreate.
- `apply.ts` : PUT update OU cancel+recreate via client Sendcloud (ajouter `cancelParcel` si absent).
- Endpoint `POST /api/auto-fix/run` chaîné en fin de `runSync`, filtre anti-pingpong (1h), max 3 tentatives.
- **Chaque pattern validé en dry_run avant l'écriture réelle.**

### Lot 2 — Tableau de bord (1 j)
- `GET /api/auto-fix/status` (KPI + pending + historique paginé).
- Page `(dashboard)/corrections-auto/` + composants (stats, table pending manuel, historique, dialog diff avant/après).
- Lien Sidebar. Retry manuel `POST /api/auto-fix/retry/[id]`.

### Lot 3 — Alertes + simulation (0,5 j)
- `escalation.ts` : seuil 5 pending sur 6h + cooldown (table `auto_fix_state`) → email.
- Mode simulation exposé dans l'UI (bascule dry_run / actif par tenant).

### Lot 4 — SMTP + reset mot de passe client + admin users (1 j)
- Configurer SMTP (Resend) dans Supabase Auth → les emails de reset partent réellement (aujourd'hui non configuré, cf incident ANTEOS 07/07).
- UI admin sur `(admin)/tenants/[id]` : reset mot de passe, activer/désactiver un user (via service_role, pas de manip DB).

### Lot 5 — Notifications email (1 j)
Réutilise le SMTP du lot 4 (d'où le prix mini) :
- envoi automatique de la facture au client (PDF joint) à la génération/validation ;
- alerte stock au client quand un SKU passe sous son seuil ;
- notif à l'équipe quand un client déclare un arrivage (inbound).

### Lot 6 — Validation & activation progressive (0,5 j)
- Tout tourne en dry_run sur staging → comparer les fixes proposés vs réalité.
- Activation **un tenant à la fois** (commencer par le plus petit, Florna en dernier).
- Surveiller `auto_fixes` (taux success/failed) + les patterns 'unknown' pour découvrir d'autres familles d'erreur.

## Points de vigilance

- **Ne rien casser sur le cron existant** : le module est isolé et chaîné en fin de run ; si l'auto-fix plante, la sync normale continue.
- **Idempotence** : ne jamais re-fixer un shipment déjà `pending_manual` ou `manual_resolved` ; compteur de tentatives + cooldown 1h.
- **Cancel+recreate (pattern 1002 + point relais si besoin)** : bien remettre à jour le `sendcloud_id` local sur le nouveau colis, sinon on perd le suivi.
- **Point relais** : vérifier que l'API Service Points renvoie bien des points pour le transporteur de la commande (Mondial Relay surtout) ; fallback `pending_manual` si aucun point trouvé.
- **Quota emails** : Resend gratuit = 100/jour ; suffisant au début, à surveiller si les factures + alertes montent.

## Estimation

~7 jours de dev répartis sur les 6 lots, livraison sous 2-3 semaines (conforme au devis).
Démarrage : à réception de l'acompte + des configs (HS codes, emails, clé SMTP).
