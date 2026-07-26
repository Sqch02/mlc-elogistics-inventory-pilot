# Les erreurs d'expédition sont prévisibles avant qu'elles n'existent

**26/07/2026. Ce document remplace `2026-07-25-auto-fix-volume-reel.md` et corrige `2026-07-26-auto-fix-vrai-volume.md`.**

---

## Pourquoi mes deux premières mesures étaient fausses

J'ai compté deux fois, et je me suis trompé deux fois, de la même façon.

**Première mesure.** 24 erreurs visibles sur 60 jours, donc environ douze par mois : l'automatisation ne vaudrait pas son coût. Faux. Quentin corrige les erreurs tous les soirs ; une fois corrigées, elles disparaissent. Je comptais **ce que personne n'avait nettoyé**, pas ce qui se produisait.

**Deuxième mesure.** 20 tâches créées en 31 heures, donc environ quinze par jour : le volume est confirmé. Faux aussi. En vérifiant l'âge des commandes concernées, 19 des 20 dataient de 74 à 138 jours. C'était le stock ancien ramassé à l'activation du détecteur — une photographie d'accumulation, pas un débit.

Et il y avait une troisième raison, plus embarrassante : **une régression que j'avais moi-même introduite** empêchait depuis le 24/07 les commandes du jour d'entrer en base chez ce client. Je cherchais des erreurs récentes dans une base qui n'en recevait plus. Le détail est dans la PR #55.

## La bonne méthode : mesurer ce qui *va* échouer

Le point de bascule est là. Une erreur Sendcloud **n'existe pas tant qu'on ne tente pas de créer l'étiquette**. Quentin les tente en lot le soir : elles apparaissent toutes d'un coup, il corrige, elles s'effacent. Aucune mesure fondée sur le champ « erreurs » ne pouvait donc les voir — ni la nôtre, ni la sienne avant qu'il ne lance le traitement.

En revanche, les **règles de validation sont connues**. On peut donc les appliquer nous-mêmes, à l'avance, sur les commandes déjà importées. On ne mesure plus les erreurs constatées : on mesure les erreurs **latentes**.

## Ce que ça donne

Lecture directe de l'API Sendcloud, 600 commandes du client principal, 25 et 26 juillet.

| | |
|---|---|
| Commandes lues | 600 |
| Portant déjà un bloc d'erreur | **1** |
| **Dépassant la limite de 32 caractères sur la voie** | **15** |

Une seule erreur constatée, quinze en attente de l'être. La commande déjà en erreur l'était sur exactement cette règle — c'est ce qui valide la méthode.

Soit environ **sept à huit par jour** pour ce seul motif. Quentin en corrige quinze à vingt chaque soir : le dépassement d'adresse en représente donc une part importante, sans être la totalité.

## Ce que le raccourcisseur sait en faire

Confronté à ces quinze cas, le module de la PR #50 dans son état initial n'en réglait que **six** sans perte d'information. Les neuf autres suivaient des motifs qui, en les regardant, ne demandaient rien de destructeur :

```
"76 grand rue hoscas Herbignac 44410"              ville + code postal recopiés
"106 B Rue de la Richelandière 42100 St Etienne"   idem
"515 route la fontaine des oiseaux 515"            numéro de voie recopié
"27 Rue du Soleil Levant (Landemont)"              lieu-dit, address_2 vide
"6 rue de la borderie - l'Aubertière"              idem
```

Retirer un code postal que la commande porte déjà dans son propre champ ne perd rien : les deux sont imprimés sur l'étiquette. Déplacer un lieu-dit vers un `address_2` **vide** ne perd rien non plus. Trois stratégies ont donc été ajoutées en amont de l'abréviation.

**Résultat sur le même échantillon : 13 des 15 corrigées automatiquement sans aucune perte.** Les deux restantes partent en revue humaine, ce qui est le bon comportement — l'une parce que son `address_2` est déjà renseigné et qu'on ne l'écrasera pas, l'autre parce qu'elle ne peut réellement qu'être coupée.

Deux défauts ont été trouvés en chemin, et ils auraient à eux seuls rendu le pattern inopérant :

- Sendcloud nomme le champ `address_1` dans ses messages, alors que la commande l'appelle `address`. La limite signalée ne trouvait donc aucune valeur à raccourcir.
- Sendcloud mesure la voie **combinée au numéro**. Sans réserver la place du numéro, la valeur produite aurait été refusée une seconde fois.

## Ce que je corrige dans mes conclusions précédentes

- J'avais écrit que le point relais représentait 70 % des erreurs. C'était l'analyse du stock ancien bloqué. Sur les 600 commandes récentes, **aucune** n'a de point relais manquant. Attention toutefois : la fermeture d'un point relais entre la commande et l'étiquette **ne peut pas** se prévoir depuis l'instantané — le champ est rempli, c'est son exploitation qui a cessé. Ce motif reste réel, il n'est simplement pas mesurable par cette méthode.
- J'avais écrit que les commandes sans article étaient suisses. Sur cet échantillon, les 4 concernées sont **françaises**. L'hypothèse d'une cause liée à la devise ne tient pas.
- J'avais écrit qu'`address_too_long` ne se produisait jamais et que le pattern armé était le mauvais. **C'est l'inverse** : c'est le seul motif aujourd'hui mesurable, prévisible et corrigible sans perte. C'est donc le bon premier pattern.

## Ce que je recommande

1. **Armer le raccourcissement d'adresse en premier**, sur ce client. C'est mesuré, prévisible, et réversible dans les faits puisque la valeur reste lisible.
2. **Détecter en amont plutôt qu'en réaction.** Le détecteur actuel attend un bloc d'erreur. Appliquer les règles de longueur aux commandes importées permettrait de corriger avant même que Quentin ne lance son traitement du soir — c'est-à-dire de supprimer le travail, pas de l'accélérer.
3. **Demander l'activation des Service Points** reste utile pour les points relais fermés, mais ce n'est plus le levier numéro un que j'annonçais.
4. **Continuer à mesurer par les règles**, pas par les erreurs constatées.

## La leçon de méthode

Deux fois j'ai compté ce qui restait visible dans un système que quelqu'un nettoie tous les soirs. La bonne question n'était pas « combien d'erreurs vois-je », mais **« combien de commandes vont être refusées si on tente l'étiquette maintenant »**. La règle était connue depuis le début ; il suffisait de l'appliquer nous-mêmes au lieu d'attendre que Sendcloud la fasse respecter.
