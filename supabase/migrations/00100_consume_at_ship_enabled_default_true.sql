-- tenant_settings.consume_at_ship_enabled passe a DEFAULT true.
--
-- Le drapeau a ete cree avec DEFAULT false pour une raison precise : chez un
-- tenant EXISTANT, l'allumer declenche le traitement d'un backlog historique
-- qui devait etre chiffre, revu et signe avant d'etre applique.
--
-- Cette raison ne vaut pas pour un tenant NOUVEAU : il n'a aucun historique a
-- recalibrer, les deux boucles du sweeper ne trouvent rien, et le drapeau ne
-- joue plus que son second role -- le filet de securite permanent.
--
-- Or /api/admin/tenants insere tenant_settings sans renseigner la colonne. Un
-- nouveau client heritait donc de false, et se retrouvait dans un etat batard :
-- les chemins go-forward (cron, webhook, sync manuel) consomment le stock sans
-- consulter le drapeau, mais la boucle de reversal du sweeper, elle, est gatee.
-- Il consommait donc sans jamais rien rendre.
--
-- Ce n'est pas theorique : sur toute l'histoire de la base, les SEULS mouvements
-- de restock sont ceux du chantier consume-at-ship du 24/07 (810 recalibration
-- + 1 reconciliation). Le reversal du webhook parcel_cancelled n'a jamais
-- tire une seule fois. Le sweeper est donc en pratique le seul mecanisme de
-- retour de stock qui fonctionne, et il etait eteint par defaut.
--
-- Les 5 tenants existants sont deja a true : cette migration ne change que le
-- comportement des tenants crees ensuite. La route de creation renseigne
-- desormais la colonne explicitement, sans dependre de ce DEFAULT.

ALTER TABLE public.tenant_settings
  ALTER COLUMN consume_at_ship_enabled SET DEFAULT true;

COMMENT ON COLUMN public.tenant_settings.consume_at_ship_enabled IS
  'Autorise les boucles retrospectives bornees du sweeper (reversal et rattrapage). '
  'DEFAULT true : un nouveau tenant n''a pas de backlog a faire signer et doit '
  'beneficier du filet des le depart. A ne repasser a false que pour geler '
  'volontairement un tenant existant avant une recalibration revue.';
