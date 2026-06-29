-- Couche 1 du matching robuste par libelle : normalisation.
-- Enleve les accents, met en minuscules, retire les mots inutiles (flacon,
-- complexe, cure, pack, le/la/les), la ponctuation, et collapse les espaces.
-- "FLACON PERTE DE POIDS", "Flacon perte de poids", "Perte de Poids" -> "perte de poids".

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalize_label(p_txt text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public, extensions'
AS $function$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(public.unaccent(coalesce(p_txt, ''))),
          '\m(flacons?|complexe|cure|pack|le|la|les)\M', ' ', 'g'
        ),
        '[^a-z0-9]+', ' ', 'g'
      ),
    ' '),
  '');
$function$;
