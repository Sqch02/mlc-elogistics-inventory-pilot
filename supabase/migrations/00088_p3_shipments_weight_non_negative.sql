-- Garde de positivite sur shipments.weight_grams (NOT VALID puis VALIDATE pour ne
-- pas prendre de lock ACCESS EXCLUSIVE long). 0 ligne en violation.
ALTER TABLE public.shipments
  ADD CONSTRAINT weight_grams_non_negative CHECK (weight_grams >= 0) NOT VALID;
ALTER TABLE public.shipments
  VALIDATE CONSTRAINT weight_grams_non_negative;
