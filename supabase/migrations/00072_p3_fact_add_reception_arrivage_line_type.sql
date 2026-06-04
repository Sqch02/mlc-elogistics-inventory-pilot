-- Etend la liste des line_type autorises pour invoice_lines avec 'reception_arrivage'.
-- Ce type couvre la facturation reception cote arrivage (palette / colis / vrac)
-- distincte du 'reception' historique qui facture au quart d'heure de manutention.

ALTER TABLE public.invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_line_type_check;

ALTER TABLE public.invoice_lines ADD CONSTRAINT invoice_lines_line_type_check
  CHECK (line_type = ANY (ARRAY[
    'shipping',
    'software',
    'storage',
    'reception',
    'reception_arrivage',
    'fuel_surcharge',
    'returns',
    'avoir',
    'avoir_technique',
    'avoir_incident_hme',
    'avoir_incident_transport',
    'avoir_reduction_volume',
    'avoir_remboursement_surcharge',
    'avoir_autre',
    'charge',
    'charge_custom'
  ]));
