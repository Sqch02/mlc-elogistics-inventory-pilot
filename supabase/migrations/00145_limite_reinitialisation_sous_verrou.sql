-- La limite de 00144 comptait puis inserait sans verrou : des demandes
-- simultanees pour la meme adresse lisaient toutes le meme compte et
-- passaient ensemble. Mesure le 04/10 : 20 appels en parallele, 6 acceptes
-- au lieu de 3.
--
-- Un verrou transactionnel par adresse (puis par IP, toujours dans cet ordre,
-- donc sans interblocage possible) range les demandes l'une apres l'autre :
-- chacune compte apres que la precedente a ete enregistree.

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
  PERFORM pg_advisory_xact_lock(hashtext('password_reset:email:' || p_email_hash));
  PERFORM pg_advisory_xact_lock(hashtext('password_reset:ip:' || p_ip_hash));

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
