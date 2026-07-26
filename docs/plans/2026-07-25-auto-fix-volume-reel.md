> # ⚠️ CE DOCUMENT CONCLUT A TORT — NE PAS S'Y FIER
>
> La mesure qui suit compte les erreurs **visibles en base**. Or l'exploitation
> corrige les erreurs chaque soir, et Sendcloud ne remplit le champ `errors`
> qu'au moment ou l'on tente de creer l'etiquette. Ce document mesure donc le
> **residu**, pas le flux — et il en tire une conclusion inverse de la realite.
>
> Document a jour : **`2026-07-26-erreurs-latentes-mesure.md`**.
>
> Conserve pour l'histoire de l'erreur de methode, qui vaut d'etre lue.

# Auto-fix : ce que disent les données réelles

**Mesuré en production le 25/07/2026, avant d'écrire le moteur d'écriture.**

Je m'apprêtais à coder le moteur qui corrige réellement les erreurs Sendcloud. Avant d'écrire une ligne, j'ai voulu savoir sur quel volume il allait travailler. Le résultat remet en cause le périmètre, et il vaut mieux le savoir maintenant qu'après cinq jours de développement.

---

## Le volume réel d'erreurs

| Mesure | Valeur |
|---|---|
| Expéditions portant un bloc `errors` | 3 402 |
| dont blocs **vides** `{}` | **3 214** |
| **Erreurs réelles, depuis toujours** | **188** |
| **Erreurs réelles, sur les 60 derniers jours** | **24** |

Soit environ **douze erreurs par mois, tous clients confondus.**

Le chiffre de 3 402 qui apparaît au premier coup d'œil est trompeur : 94 % sont des objets vides. C'est le piège dans lequel je serais tombé si je m'étais fié au nombre d'expéditions « en erreur ».

## Leur nature, sur 60 jours

| Erreur | Client | Nb | Auto-corrigeable ? |
|---|---|---|---|
| `contract` — « Contract is not valid for the selected shipping method » | MOTIJET | **14** | ❌ Configuration du compte transporteur |
| `to_service_point` — « Service point no longer operational » | MOTIJET, FLORNA | 4 | ⚠️ Point relais — bloqué chez Sendcloud |
| `city` — « Ensure that city has at most 26 characters » | FLORNA | **2** | ✅ C'est le pattern « adresse trop longue » |
| Caractères non latins pour Delivengo | FLORNA | 2 | ⚠️ Transliteration — **pattern absent du cahier des charges** |
| `parcel_items`, `shipping_method`, `postal_code` | divers | 3 | ❌ Données manquantes à la source |

**Deux constats qui comptent :**

1. **Le pattern CHF n'a produit aucune erreur en 60 jours.** FLORNA a pourtant 451 colis en CHF (11 sur la période) — les commandes suisses existent, mais elles ne génèrent pas d'erreur. Or c'est le pattern sur lequel le plus d'effort a été investi, calcul de conversion compris.

2. **58 % des erreurs (14 sur 24) sont un problème de contrat transporteur chez MOTIJET**, répété sur chaque colis concerné. Ce n'est pas une erreur à corriger colis par colis : c'est **un réglage à faire une fois** dans leur compte Sendcloud, exactement comme l'EORI manquant que le plan a déjà classé « alerte, pas auto-fix ».

---

## Ce que ça implique

Le moteur d'écriture, tel que cadré, viserait :

- `address_too_long` → **2 cas en 60 jours**
- `currency_chf` → **0 cas en 60 jours**

Construire une écriture irréversible vers une API externe, avec machine à états, reprise après crash et vérification par relecture, pour **deux corrections tous les deux mois**, c'est un mauvais rapport effort/valeur. Et c'est le morceau le plus risqué du projet.

**Le plus gros gain disponible n'est pas technique.** Dire à MOTIJET de corriger son contrat transporteur élimine 58 % des erreurs, définitivement, en une conversation.

## Réserves, par honnêteté

- Ces chiffres reflètent ce qui est **visible aujourd'hui**. Si une erreur est corrigée à la main puis que le colis se resynchronise, le bloc d'erreur peut disparaître : l'historique sous-estime probablement la fréquence passée.
- Le cahier des charges a été écrit à partir de cas réels vus avec Quentin. Il est possible que les patterns aient été fréquents à une période puis se soient taris — je n'ai pas pu établir la distribution historique complète sans faire un scan lourd sur une table de 738 Mo, et l'incident I/O du 13/07 impose de ne pas se le permettre.
- La valeur peut ne pas être dans le volume mais dans la **pénibilité** : douze erreurs par mois traitées à la main, avec la recherche de cause à chaque fois, ça reste du temps perdu.

## Ce que je recommande

1. **Vérifier le volume avec Quentin** avant d'aller plus loin. Est-ce qu'il traite douze erreurs par mois, ou beaucoup plus ? Si son ressenti est très supérieur à la mesure, c'est que les erreurs sont effacées à la correction et qu'il faut instrumenter autrement.
2. **Traiter le contrat MOTIJET** : le gain le plus important, pour un coût nul.
3. **Recentrer le moteur** : la détection, le tableau de bord et les alertes apportent déjà l'essentiel de la valeur — savoir immédiatement qu'une commande est bloquée et pourquoi. L'écriture automatique peut se limiter à `address_too_long`, seul pattern à la fois fréquent, sûr et non bloqué.
4. **Ajouter le pattern « caractères non latins »** (Delivengo), absent du cahier des charges et aussi fréquent que l'adresse trop longue.
5. **Réinvestir l'effort libéré** sur les lots à valeur certaine : les notifications email et la gestion autonome des comptes clients, qui répondent à un besoin exprimé et ne dépendent d'aucune hypothèse de volume.
