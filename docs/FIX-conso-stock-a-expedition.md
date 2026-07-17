# Correctif : consommer le stock à l'expédition (pas au stade « No label »)

**Statut : à valider par Aurélien avant tout déploiement.** Changement du cœur métier (moment où le stock est décompté) → impacte tous les tenants.

## Problème constaté (REBORN21, 15/07/2026)

Quentin signale : l'app affiche 0 activateur (R21A) alors qu'il en reste 58 physiquement ; 59 stabilisateur (R21PS) contre 58 réels.

## Cause racine (confirmée en base)

Une même commande apparaît **deux fois dans sa vie** côté Sendcloud :

1. **Stade « No label »** (`status_id = 999`, pas encore étiquetée, flux intégration) : Sendcloud liste la ligne avec `quantity = nombre de flacons`. Ex. le 15/07, 6 commandes `SKU_R21A6, quantity = 6`.
2. **Stade expédié** (`status_id = 11` Delivered, etc.) : la ligne devient `quantity = 1` (nombre de packs).

Or `SKU_R21A6` est un **bundle** (6 × flacon activateur). L'app consomme le stock **dès le stade 1 (No label)** :

```
quantity (6)  ×  qty_component du bundle (6)  =  36 activateurs consommés  (au lieu de 6)
```

Quand la commande passe au stade 2 (`quantity = 1`, qui donnerait le bon `1 × 6 = 6`), le colis a **déjà** été consommé (`stock_consumed_at` posé) → jamais recorrigé. `GREATEST(0, …)` masque le passage sous zéro, d'où l'affichage à 0 alors qu'il reste 58.

**Deux problèmes cumulés :** (1) consommation **trop tôt** (avant expédition) ; (2) à ce stade la quantité est au format « nombre de flacons » qui **sur-décompose** via le bundle.

Vérifié : le format bugué est **strictement corrélé** au statut « No label » (999). Les commandes expédiées (`quantity = 1`) se décomposent correctement. Confirmé aussi que **seul REBORN21 est concerné** — chez Florna les bundles qty>1 sont sur des colis réellement expédiés (commandes multiples légitimes), pas au stade No-label.

## Correctif proposé

**Ne consommer le stock qu'une fois le colis étiqueté / pris en charge par le transporteur, pas au stade « No label ».**

- Corrige les deux problèmes d'un coup : plus de consommation prématurée, et au moment où on consomme la quantité est au bon format (`quantity = 1`).
- Plus juste métier : le stock quitte l'entrepôt quand le colis part, pas quand la commande tombe.

### Changement technique

Aujourd'hui la consommation est déclenchée par « expédition **nouvelle** + items mappés » (`newSendcloudIds`), aussi bien dans le cron que le webhook. Il faut la déclencher par **« statut = expédié/étiqueté ET pas encore consommé »** (le verrou CAS sur `stock_consumed_at` garantit toujours l'unicité).

- Ajouter un helper `isConsumableStatus(status_id)` : exclut `999` (No label), les états d'attente (On Hold) et annulés ; inclut les états à partir de l'étiquetage.
- **Question ouverte pour Aurélien / Quentin** : à partir de quel statut exactement considère-t-on qu'on consomme ? Candidats : `Ready to send (1000)`, `Announced (1)`, `En route`, `Delivered (11)`. Recommandation : dès qu'une **étiquette existe** (label créé / annoncé au transporteur), car c'est le moment où le stock part réellement.
- Ajouter un **balayage de réconciliation** : consommer les colis passés au statut expédié mais restés `stock_consumed_at IS NULL` (ferme aussi le trou de sous-consommation déjà identifié quand un process meurt en plein sync).

## Déploiement sûr (canary)

1. Déployer derrière un garde-fou, **REBORN21 uniquement** d'abord.
2. Vérifier en lecture seule que la consommation se cale bien sur l'expédition (comparer Sendcloud/DB).
3. Étendre aux autres tenants (Florna en dernier, cf. son stock déjà réconcilié).

## Ce qui a déjà été fait (15/07)

- **Stock REBORN21 recalé sur le comptage physique de Quentin** : R21A 0→58, R21PS 59→58 (ajustement manuel tracé + refresh vue). Visible dans l'app.
- **Surveillance** : requête de détection de la signature du bug (ci-dessous). À relancer périodiquement en attendant le correctif — REBORN21 peut re-dériver à chaque nouvelle commande pack au stade No-label.

```sql
-- Détecteur : commandes "No label" (999) avec un bundle en qty>1 ayant consommé du stock
select sh.tenant_id, sh.order_ref, sh.stock_consumed_at,
  (select string_agg(s2.sku_code||' x'||si.qty, ', ')
     from shipment_items si join skus s2 on s2.id = si.sku_id
     where si.shipment_id = sh.id
       and exists(select 1 from bundles b where b.bundle_sku_id = si.sku_id) and si.qty > 1) as bundle_items
from shipments sh
where sh.status_id = 999 and sh.stock_consumed_at is not null
  and exists(select 1 from shipment_items si join bundles b on b.bundle_sku_id = si.sku_id
             where si.shipment_id = sh.id and si.qty > 1)
order by sh.stock_consumed_at desc;
```
