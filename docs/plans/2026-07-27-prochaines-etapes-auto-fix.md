# Ce qu'il reste à faire pour que les corrections deviennent automatiques

**27/07/2026. Écrit à la fin de la nuit de travail, pour que la reprise soit immédiate.**

---

## Où on en est

Tout le code est fusionné sur `main`. Dix pull requests dans la nuit, aucune en attente, 631 tests verts.

La chaîne complète existe et fonctionne, prouvée par un test de bout en bout :

```
commande brute  →  détection latente  →  limite extraite  →  patch concret
```

Sur 994 commandes en attente du client principal : **18 à corriger, dont 13 sans aucune perte d'information.**

## Ce qui bloque encore, précisément

Trois choses, dans cet ordre. Aucune n'est du développement lourd.

### 1. Le moteur refuse les commandes importées

`src/lib/auto-fix/live-worker.ts` contient :

```ts
// La creation liee via shipment_uuid n'est pas validee : on n'ecrit
// que sur des colis numeriques.
if (job.source_kind !== 'parcel') {
  await refuse('integration_shipment_not_supported'); continue
}
```

Or **les 18 erreurs sont toutes des commandes importées**. Même tout armé, le moteur les refuserait une par une.

Le module `src/lib/sendcloud/orders-v3.ts` lève ce blocage — il sait corriger une commande importée — mais il n'a **aucun appelant**.

**Ce qu'il faut faire.** Brancher `orders-v3` dans le worker pour la branche `source_kind === 'integration_shipment'`.

Un détail à régler au passage : le worker ne dispose pas du numéro de commande. `LiveJob` porte `original_sendcloud_id`, qui vaut le `shipment_uuid`, et la v3 n'expose pas ce champ (vérifié). Le numéro de commande est en revanche dans notre base (`shipments.order_ref`). Le plus propre est d'ajouter une dépendance injectée `resolveOrderRef(tenantId, sendcloudId)` plutôt que de modifier la RPC de réclamation — c'est testable et ça ne touche pas la migration.

### 2. La forme exacte du corps du PATCH n'est pas validée

`OPTIONS /api/v3/orders/{id}` déclare `GET, PATCH, DELETE`. Le module envoie :

```json
{ "shipping_address": { "address_line_1": "..." } }
```

Cette forme est cohérente avec celle de lecture, mais **elle n'a jamais été envoyée**. Une seule écriture la validera.

**Comment la valider sans risque.** Envoyer l'adresse **actuelle** d'une commande, inchangée. Si la forme est bonne, rien ne change dans le contenu. Si elle est mauvaise, on récupère un 4xx et le message d'erreur. Aucune donnée n'est altérée dans les deux cas.

À faire sur une commande choisie, jamais en lot.

### 3. Trois interrupteurs sur Render, tous fermés

```
AUTO_FIX_LATENT_DETECTION=true    remplit la file de ce qui VA échouer (simulation seule)
AUTO_FIX_PAUSED=false             lève la pause générale
AUTO_FIX_LIVE_ENABLED=true        autorise l'écriture réelle
```

Plus `auto_fix_mode='live'` sur le tenant concerné, et les migrations **00101** et **00102** à appliquer (présentes sur `main`, pas appliquées, inertes).

**Le premier est sans aucun risque d'écriture** et devrait être activé en premier : il rend visible, dans le tableau de bord, exactement ce que le moteur corrigerait.

## L'ordre que je recommande

1. Activer `AUTO_FIX_LATENT_DETECTION` et laisser tourner une journée. On voit le volume réel se remplir sans qu'une seule écriture ait lieu.
2. Valider la forme du PATCH par une écriture neutre sur une commande.
3. Brancher `orders-v3` dans le worker, avec la résolution du numéro de commande.
4. Appliquer 00101, armer **un seul** tenant, surveiller.

Le repli est immédiat à chaque étape : `AUTO_FIX_PAUSED=true`.

## En attendant, le travail manuel est déjà réduit

```
node --env-file=.env.local --import tsx scripts/liste-corrections-sendcloud.ts florna
```

Sort la liste des commandes qui vont être refusées, avec la valeur exacte à taper pour celles qui se corrigent sans perte, et celles qui demandent un jugement humain séparées à part.

## Deux limites connues, assumées

**Fraîcheur du snapshot.** Pendant le rattrapage (jusqu'à trois jours en arrière), les commandes du jour n'entrent pas : au pire environ 25 minutes de retard. Acceptable aujourd'hui. Le correctif propre serait de toujours lire la page 1 à chaque cycle, puis d'utiliser le budget de pages restant pour le rattrapage.

**Les corrections n'ont pas eu de relecture indépendante.** Elles sont produites par du code testé sur les cas réels, et chacune est sans perte par construction — retrait d'un doublon déjà porté par un autre champ, abréviation postale standard, déplacement vers un champ vide. Le risque est faible, mais ce n'est pas la même chose qu'un second regard.
