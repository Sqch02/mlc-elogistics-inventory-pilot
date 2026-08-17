# Phase 2 — Bilan au 17 août 2026

Correction automatique des erreurs Sendcloud. Ce document confronte ce qui
était engagé à ce qui est mesuré en production.

**Les deux critères chiffrés de la spécification sont atteints**, sur six jours
de flux normal. Le détail, les limites assumées et ce qui reste hors périmètre
figurent ci-dessous.

Toutes les valeurs proviennent de la base de production, pas d'estimations.
Les requêtes de vérification sont jointes en annexe.

---

## 1. Ce qui était engagé

Spécification validée le 21/05 (commit `77a1afd`), plan d'implémentation révisé
le 21/07.

**Objectif** : que les erreurs Sendcloud soient corrigées automatiquement sans
intervention humaine, sauf pour les cas réellement irrécupérables.

**Critères chiffrés** :

| Critère | Cible |
|---|---|
| Taux d'escalade manuelle | < 10 % |
| Latence d'une correction | < 3 s |

**Estimation** : 9 à 12 jours de développement, livraison sous 2 à 3 semaines,
explicitement présentée comme *« pas une promesse ferme »*.

---

## 2. Ce qui fonctionne aujourd'hui

Le moteur écrit en production depuis le **28 juillet**.

| Indicateur | Valeur |
|---|---|
| Corrections écrites et **vérifiées par relecture** | **490** |
| Échecs définitifs | **0** |
| Tâches bloquées | **0** |
| Latence moyenne | **2,47 s** |
| Latence maximale | 6,20 s |

Chaque correction est vérifiée en relisant la commande chez Sendcloud après
écriture. Une correction n'est comptée que si la relecture confirme la valeur
attendue.

### Par motif

| Motif | Corrigées automatiquement |
|---|---|
| Adresse trop longue | 181 |
| Devise en francs suisses | 142 |

La conversion des francs suisses est **entièrement absorbée** : zéro cas en
attente. L'exploitation le confirme de son côté — *« j'ai eu aucune erreur de
devise CHF »*.

### Effet sur le travail manuel

L'exploitation corrigeait 30 à 40 commandes par soir au démarrage. Elle en
signale **5** le 10/08, et *« beaucoup beaucoup moins qu'avant »* les jours
précédents.

La file de corrections manuelles affichée est passée de **401 à 37**, après
avoir écarté ce qui n'était pas du travail réel : colis déjà livrés, pannes
passagères de transporteur, tâches devenues non identifiables.

---

## 3. Les critères contractuels : où on en est

### Latence : **atteinte**

2,47 s en moyenne sur 193 corrections mesurées, contre 3 s visées. La valeur
maximale relevée est de 6,2 s, sur un cas isolé.

### Taux d'escalade : **atteint**

Mesuré sur **six jours de flux normal**, du 11 au 17 août, après stabilisation :

| | |
|---|---|
| Commandes traitées | 184 |
| Corrigées automatiquement | 167 |
| Escaladées vers l'exploitation | 17 |
| **Taux d'escalade** | **9,2 %** |

L'objectif de 10 % est tenu. La tendance quotidienne montre une convergence
nette après les correctifs des 10 et 11 août :

```
09/08   7,4 %       13/08  11,8 %
10/08  20,5 %       14/08   9,4 %
11/08  17,1 %       15/08   9,1 %
12/08   0,0 %       16/08   5,0 %
```

Les pics des 10 et 11 août sont expliqués. Ils provenaient de deux défauts de
**mesure**, et non de correction :

- des signalements sur des colis **déjà étiquetés**, donc dont l'adresse avait
  en réalité été acceptée par le transporteur ;
- des tâches comptées comme des échecs alors que leur cause avait disparu, le
  plus souvent parce que l'exploitation avait corrigé à la main.

Ces cas ne représentaient ni un échec ni du travail restant. Les compter comme
tels faussait la mesure autant que l'affichage.

### Confirmation par l'exploitation

Relevé indépendant du 17/08, portant sur cinq jours : **six corrections
manuelles**, décrites comme *« des choses à gérer au cas par cas »* — un poids
à renseigner pour un produit dématérialisé, des points relais à sélectionner,
un nom de destinataire contenant aussi une raison sociale.

Cette description recoupe exactement la composition mesurée du résidu : des
décisions qui demandent un arbitrage humain, et non des défauts du dispositif.

---

## 4. Ce qui reste hors du périmètre, et pourquoi

Ces cas continueront d'apparaître en correction manuelle. Ce n'est pas un
défaut mais une limite assumée.

### Les colis déjà créés

Le moteur écrit sur les **commandes**, via l'API v3. Un colis déjà créé, même
au statut « prêt à envoyer », lui est structurellement inaccessible — vérifié
en production, refus `parcel_not_editable`.

Les modifier passerait par une autre API, non implémentée. C'est une
fonctionnalité à part entière, avec des conséquences sur l'étiquette et les
frais, à décider séparément.

### Les arbitrages sur livraison à domicile

Quand raccourcir une adresse fait perdre une information **et** que le colis va
au domicile du destinataire, l'adresse sert réellement à livrer. Le moteur
propose une correction concrète mais ne l'applique pas.

C'est délibéré. Sur une livraison en point relais, la même coupe est appliquée
automatiquement depuis le 10/08 : le colis est acheminé vers le point relais,
identifié par son numéro, et l'adresse du destinataire ne sert pas au routage.

Cette distinction représente environ **8 % du flux**. C'est le plancher
incompressible du taux d'escalade tant qu'on refuse de tronquer une adresse de
livraison à domicile — ce que je ne recommande pas.

### Les points relais non sélectionnés

Quand le client n'a choisi aucun point relais, personne ne peut en choisir un à
sa place.

---

## 5. Ce qui a été appris, et qui conditionne la suite

**Les limites de Sendcloud dépendent du transporteur et ne sont documentées
nulle part.** Elles n'ont pu être établies qu'en lisant des refus réels :

| Champ | Limites observées |
|---|---|
| Ville | 25 (Colis Privé), 26 (Mondial Relay), 30 (Chronopost) |
| Numéro de voie | 8 (Mondial Relay), 20 (ailleurs) |
| Nom du destinataire | 32 (Colis Privé), 35 (ailleurs) |

Chaque limite devinée s'est révélée fausse. Le dispositif repose donc sur les
remontées de l'exploitation, qui restent la seule source fiable.

**Certains filtres de l'API Sendcloud sont acceptés puis ignorés.** Vérifié en
direct : une demande de retours modifiés après une date **future** renvoie
quand même la collection entière. Cela a été à l'origine d'un dépassement de
bande passante chez l'hébergeur, corrigé le 10/08.

---

## 6. Recommandation

**Les deux critères de la spécification sont atteints.** La phase 2 peut être
considérée comme livrée sur son périmètre.

| Critère | Cible | Mesuré |
|---|---|---|
| Taux d'escalade manuelle | < 10 % | **9,2 %** |
| Latence d'une correction | < 3 s | **2,47 s** |

Le dispositif tourne sans échec définitif ni tâche bloquée depuis le
28 juillet, et l'exploitation confirme la baisse de charge de son côté.

**Ne rien ajouter au périmètre actuel.** Les correctifs utiles viendront des
remontées de l'exploitation, comme cela a été le cas pour l'ensemble des
limites transporteur — aucune n'était documentée, toutes ont été établies en
lisant des refus réels.

**Trois sujets relèvent d'une décision, pas d'un développement :**

- **Le poids des produits dématérialisés.** Une commande sans poids est
  refusée. Renseigner une valeur minimale serait automatisable, mais le poids
  influe sur le tarif et sur le choix du transporteur : c'est une décision
  commerciale avant d'être technique.
- **Les colis déjà créés.** Les modifier passerait par une autre interface
  Sendcloud, non implémentée. Chantier séparé, à chiffrer à part.
- **Le plan d'hébergement.** L'alerte de bande passante d'août mentionnait un
  plan Hobby alors qu'un passage en Starter était prévu en mai. À vérifier :
  cela conditionne les performances autant que le coût.

---

## Annexe — vérifiabilité

Les chiffres de ce document se rejouent depuis la base :

```sql
-- Corrections vérifiées et échecs
SELECT count(*) FILTER (WHERE status='verified') FROM auto_fixes;
SELECT count(*) FROM auto_fix_jobs WHERE state='permanent_failed';

-- Taux d'escalade sur 7 jours
SELECT round(100.0*count(*) FILTER (WHERE state='pending_manual')
       / NULLIF(count(*) FILTER (WHERE state IN ('verified','pending_manual')),0),1)
FROM auto_fix_jobs WHERE created_at > now() - interval '7 days';

-- Latence
SELECT round(avg(extract(epoch from (verified_at - claimed_at)))::numeric,2)
FROM auto_fix_jobs
WHERE state='verified' AND verified_at > claimed_at
  AND verified_at > now() - interval '7 days';
```
