-- Limiter les demandes de reinitialisation de mot de passe.
--
-- La page « mot de passe oublie » est publique : n'importe qui peut y saisir
-- n'importe quelle adresse. Sans limite, elle permettrait d'inonder la boite
-- d'un client de liens, ou de faire consommer notre quota d'envoi.
--
-- On ne garde que des EMPREINTES (sha256) de l'adresse et de l'adresse IP :
-- la table sert a compter, pas a savoir qui a demande quoi. Les lignes de plus
-- d'un jour sont purgees au passage.

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email
  ON public.password_reset_requests (email_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_ip
  ON public.password_reset_requests (ip_hash, created_at);

-- Aucune politique : seul le role serveur y accede.
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.password_reset_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.password_reset_requests TO service_role;

-- Enregistre la demande et dit si elle est autorisee.
--
--   3 demandes par adresse et par heure : assez pour un client qui ne trouve
--     pas le mail, trop peu pour inonder une boite ;
--   10 demandes par adresse IP et par heure : un bureau partage passe, une
--     enumeration d'adresses non.
--
-- La demande est enregistree MEME refusee : sinon un abus soutenu ne serait
-- jamais compte au-dela du seuil.
CREATE OR REPLACE FUNCTION public.password_reset_allowed(
  p_email_hash text,
  p_ip_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_par_adresse integer;
  v_par_ip integer;
BEGIN
  DELETE FROM public.password_reset_requests WHERE created_at < now() - interval '1 day';

  SELECT count(*) INTO v_par_adresse FROM public.password_reset_requests
  WHERE email_hash = p_email_hash AND created_at > now() - interval '1 hour';
  SELECT count(*) INTO v_par_ip FROM public.password_reset_requests
  WHERE ip_hash = p_ip_hash AND created_at > now() - interval '1 hour';

  INSERT INTO public.password_reset_requests (email_hash, ip_hash)
  VALUES (p_email_hash, p_ip_hash);

  RETURN v_par_adresse < 3 AND v_par_ip < 10;
END;
$function$;

REVOKE ALL ON FUNCTION public.password_reset_allowed(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_reset_allowed(text, text) TO service_role;
