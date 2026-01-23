-- Migration: Add indemnity_source column to claims
-- Description: Track whether indemnity is paid by HME or carrier

ALTER TABLE claims ADD COLUMN IF NOT EXISTS indemnity_source TEXT
  CHECK (indemnity_source IN ('hme', 'transporteur'));

COMMENT ON COLUMN claims.indemnity_source IS 'Source of indemnity: hme = paid by HME, transporteur = paid by carrier';
