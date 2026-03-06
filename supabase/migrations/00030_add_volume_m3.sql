-- Add volume_m3 field to SKUs for cubic meter tracking
ALTER TABLE skus ADD COLUMN IF NOT EXISTS volume_m3 NUMERIC;

COMMENT ON COLUMN skus.volume_m3 IS 'Unit volume in cubic meters (m3)';
