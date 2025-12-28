# Contexte projet

## Client
- Société : MLC PROJECT (activité 3PL / logistique e-commerce)
- Contact : Aurélien PRUVOST

## Objectif
Construire une application web (mini logiciel) permettant de centraliser et visualiser les données logistiques (principalement via Sendcloud) et d'aider au pilotage:
- SKUs / produits
- Stock + prévisions
- Bundles (BOM)
- Emplacements (racks)
- Pricing transport (transporteur + tranches de poids)
- Facturation mensuelle
- Réclamations (SAV) + indemnisation manuelle

## Contraintes clés validées
- Poids de référence pour le pricing : poids indiqué sur l'étiquette d'expédition Sendcloud (label).
- Pricing : uniquement transporteur + tranches de poids (pas de volumétrique/surcharges complexes en V1 sauf ajout explicite).
- Réclamations : indemnisation décidée manuellement, montant saisi au cas par cas.
- Emplacements : 1 SKU par emplacement. Quantité par emplacement non incluse en V1 (stock géré globalement).
- V1: tests et usage sur 1 client pilote d'abord, multi-clients prévu en fin de V1.

## Infra
- Backend/DB : Supabase (Postgres)
- Hébergement : Render (ou équivalent)
- Accès Sendcloud fournis par le client (tokens/credentials)
- Les coûts d'abonnements des services tiers sont à la charge du client.
