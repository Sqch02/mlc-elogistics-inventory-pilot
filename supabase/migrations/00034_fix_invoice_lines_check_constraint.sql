-- Migration: Allow avoir line types in invoice_lines
-- Problem: CHECK constraint only allowed shipping/software/storage/reception/fuel_surcharge/returns
-- Fix: Add avoir_remise, avoir_retour, avoir_autre, avoir, charge to allowed types

ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_line_type_check;

ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_line_type_check
  CHECK (line_type IN (
    'shipping', 'software', 'storage', 'reception', 'fuel_surcharge', 'returns',
    'avoir_remise', 'avoir_retour', 'avoir_autre', 'avoir', 'charge'
  ));
