# Palier CHF concret — dry-run uniquement

Date : 22 juillet 2026

## Décision

Le planner calcule une correction CHF → EUR complète mais ne l'applique jamais. Le lot ne contient
aucun client d'écriture Sendcloud, aucune écriture stock et aucun chemin live.

## Taux

- Source : ECB Data Portal, série quotidienne `EXR.D.CHF.EUR.SP00.A`.
- Contrat source : `1 EUR = X CHF`; le taux dérivé audité est `1 CHF = 1/X EUR`.
- Observation utilisée : dernière observation publiée au moment du worker, avec sa `rate_date`.
- Une observation âgée de plus de 7 jours est refusée.
- Cache global persistant 24 h dans `exchange_rates_cache`.
- Une réservation atomique en base précède le fetch et bloque toute autre tentative pendant 24 h,
  y compris après un échec. Le maximum est donc un appel BCE par paire et par jour, même avec des
  workers concurrents.

Références officielles :

- https://data.ecb.europa.eu/help/api/data
- https://data.ecb.europa.eu/help/api/data-examples
- https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.fr.html

Les taux BCE sont des taux de référence publiés à titre informatif. Le plan conserve explicitement
la source, la série, la date, la cotation reçue et le taux dérivé pour rendre la décision vérifiable.

## Règle d'arrondi et cohérence

1. Les montants sources doivent être des décimaux CHF positifs ou nuls avec au plus deux décimales.
2. La sémantique de `parcel_items[].value` est établie à partir des données sources : le planner
   vérifie d'abord le contrat Sendcloud usuel de valeur unitaire (`Σ value × quantity`), puis accepte
   le total de ligne (`Σ value`) pour les intégrations qui l'exposent ainsi. La règle retenue est
   inscrite dans le plan ; si aucune somme ne correspond au total, le calcul est refusé.
3. Le total CHF doit être exactement égal à la somme effective des items selon cette règle.
4. Chaque ligne est convertie en arithmétique entière exacte :
   `EUR cents = round_half_up(CHF cents / cotation CHF-par-EUR)`.
5. Le `total_order_value` EUR final est la somme effective des items EUR déjà arrondis, quantité
   comprise lorsque les valeurs sources sont unitaires.
6. La conversion directe du total et l'écart avec la somme des lignes sont conservés dans le plan.

Cette règle garantit toujours `total EUR = somme des items EUR`. Elle évite les flottants binaires et
rend les écarts d'un centime explicables quand plusieurs lignes sont arrondies séparément.

## États

Le changement CHF porte `calculation_status=ready` et le plan porte `wouldEndState=verified` seulement si :

- la devise source est exactement CHF ;
- le taux BCE daté est frais et persisté ;
- le total et toutes les valeurs/quantités d'items sont valides ;
- le total CHF est égal à la somme des lignes CHF ;
- le total EUR calculé est égal à la somme des lignes EUR.

Sinon, le plan reste `pending_manual`, avec `action=manual_required` et un `reason_code` stable : taux
indisponible, devise inattendue, total/items absents, quantité invalide ou incohérence total/items.

## Données auditées

`source_summary_json` / `before_json` conservent uniquement les montants, indices et quantités utiles.
Aucun SKU, nom, adresse, email ou description produit n'est ajouté. Le `change` CHF du `plan_json` /
`after_json` contient :

- avant et après concrets (devise, total, valeurs de lignes) ;
- taux BCE, série, date, cotation source, date de fetch et expiration cache ;
- règle d'arrondi, conversion directe et écart d'allocation ;
- contrôles de cohérence source et cible.

La purge PII/JSON existante à 30 jours s'applique sans modification.
