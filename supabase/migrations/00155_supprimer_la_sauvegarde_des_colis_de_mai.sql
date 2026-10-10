-- Suppression de la copie des colis prise le 30/05, avant les migrations de
-- securite de mai : backup.backup_20260530_shipments, 110 904 colis de 5
-- clients (crees du 29/12/2025 au 30/05/2026 23 h 05), 348 Mo, soit le tiers
-- de la base apres le menage du 09/10.
--
-- Plus restaurable en pratique : revenir a l'etat du 30/05 effacerait plus de
-- quatre mois de donnees. Aucun objet n'en dependait. Supprimee le 09/10 avec
-- l'accord de Maxime.
--
-- Les autres sauvegardes du 30/05 (petites tables : tarifs, factures,
-- clients, stock...) et celles de juillet sont conservees (moins de 60 Mo).

DROP TABLE IF EXISTS backup.backup_20260530_shipments;
