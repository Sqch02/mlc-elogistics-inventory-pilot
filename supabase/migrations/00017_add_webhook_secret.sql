-- Add webhook secret column to tenant_settings for per-tenant Sendcloud webhook validation
-- Each tenant can have their own Sendcloud webhook secret for secure multi-tenant webhooks

ALTER TABLE tenant_settings
ADD COLUMN IF NOT EXISTS sendcloud_webhook_secret TEXT;

-- Add comment for documentation
COMMENT ON COLUMN tenant_settings.sendcloud_webhook_secret IS 'Per-tenant Sendcloud webhook secret for signature validation';
