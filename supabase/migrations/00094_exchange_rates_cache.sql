-- Cache global des taux BCE utilise uniquement pour calculer des plans dry-run.
-- Cette migration ne cree aucune capacite d'ecriture Sendcloud ou stock.

CREATE TABLE IF NOT EXISTS public.exchange_rates_cache (
  base_currency text NOT NULL,
  target_currency text NOT NULL,
  rate numeric(20, 12),
  rate_date date,
  provider text,
  provider_quote numeric(20, 12),
  fetched_at timestamptz,
  expires_at timestamptz,
  refresh_not_before timestamptz NOT NULL DEFAULT '-infinity'::timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, target_currency),
  CONSTRAINT exchange_rates_cache_currency_codes CHECK (
    base_currency ~ '^[A-Z]{3}$'
    AND target_currency ~ '^[A-Z]{3}$'
    AND base_currency <> target_currency
  ),
  CONSTRAINT exchange_rates_cache_positive_values CHECK (
    (rate IS NULL OR rate > 0)
    AND (provider_quote IS NULL OR provider_quote > 0)
  ),
  CONSTRAINT exchange_rates_cache_chf_eur_plausibility CHECK (
    base_currency <> 'CHF'
    OR target_currency <> 'EUR'
    OR rate IS NULL
    OR (
      rate BETWEEN 0.5 AND 2.0
      AND provider_quote BETWEEN 0.5 AND 2.0
      AND abs((rate * provider_quote) - 1) <= 0.000000001
    )
  ),
  CONSTRAINT exchange_rates_cache_provider CHECK (provider IS NULL OR provider = 'ECB'),
  CONSTRAINT exchange_rates_cache_complete_rate CHECK (
    (rate IS NULL AND rate_date IS NULL AND provider IS NULL AND provider_quote IS NULL
      AND fetched_at IS NULL AND expires_at IS NULL)
    OR
    (rate IS NOT NULL AND rate_date IS NOT NULL AND provider IS NOT NULL AND provider_quote IS NOT NULL
      AND fetched_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at > fetched_at)
  )
);

ALTER TABLE public.exchange_rates_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates_cache FORCE ROW LEVEL SECURITY;

-- Table globale sans acces utilisateur. Le service role est le seul lecteur et
-- ecrivain ; aucune policy authenticated n'est volontairement creee.
REVOKE ALL ON TABLE public.exchange_rates_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.exchange_rates_cache TO service_role;

DROP TRIGGER IF EXISTS exchange_rates_cache_updated_at ON public.exchange_rates_cache;
CREATE TRIGGER exchange_rates_cache_updated_at
  BEFORE UPDATE ON public.exchange_rates_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Reservation atomique du rafraichissement. Le bail court est ecrit AVANT
-- l'appel BCE : il evite les appels concurrents, mais autorise un nouveau retry
-- borne apres un echec. Un save reussi pose refresh_not_before a expires_at
-- (24 h) dans l'upsert applicatif.
CREATE OR REPLACE FUNCTION public.claim_exchange_rate_refresh(
  p_base_currency text,
  p_target_currency text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed boolean;
  v_base text := upper(trim(p_base_currency));
  v_target text := upper(trim(p_target_currency));
BEGIN
  IF v_base !~ '^[A-Z]{3}$' OR v_target !~ '^[A-Z]{3}$' OR v_base = v_target THEN
    RAISE EXCEPTION 'invalid currency pair';
  END IF;

  WITH claimed AS (
    INSERT INTO public.exchange_rates_cache (
      base_currency, target_currency, refresh_not_before
    ) VALUES (
      v_base, v_target, now() + interval '15 minutes'
    )
    ON CONFLICT (base_currency, target_currency) DO UPDATE
      SET refresh_not_before = now() + interval '15 minutes', updated_at = now()
      WHERE public.exchange_rates_cache.refresh_not_before <= now()
        AND (
          public.exchange_rates_cache.expires_at IS NULL
          OR public.exchange_rates_cache.expires_at <= now()
        )
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed) INTO v_claimed;

  RETURN v_claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_exchange_rate_refresh(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_exchange_rate_refresh(text, text)
  TO service_role;

COMMENT ON TABLE public.exchange_rates_cache IS
  'Cache global 24 h des taux BCE pour plans auto-fix dry-run; aucun acces anon/authenticated.';
COMMENT ON COLUMN public.exchange_rates_cache.rate IS
  'Taux derive : une unite de base_currency vaut rate unites de target_currency.';
COMMENT ON COLUMN public.exchange_rates_cache.provider_quote IS
  'Cotation BCE source pour D.CHF.EUR.SP00.A : une unite EUR vaut X CHF.';
