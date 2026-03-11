-- Migration: Allow avoir line types in invoice_lines
-- Problem: CHECK constraint only allowed shipping/software/storage/reception/fuel_surcharge/returns
-- Fix: Add avoir_remise, avoir_retour, avoir_autre, avoir, charge to allowed types

ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_line_type_check;

ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_line_type_check
  CHECK (line_type IN (
    'shipping', 'software', 'storage', 'reception', 'fuel_surcharge', 'returns',
    'avoir', 'avoir_technique', 'avoir_incident_hme', 'avoir_incident_transport',
    'avoir_reduction_volume', 'avoir_remboursement_surcharge', 'avoir_autre',
    'charge', 'charge_custom'
  ));
