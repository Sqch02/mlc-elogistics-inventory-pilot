-- Checkpoints persistants du cron Sendcloud.
--
-- parcels / returns : le watermark n'avance qu'apres vidage complet de la
-- fenetre. En cas de cap, cursor + window_ends_at permettent de reprendre le
-- meme drain au tick suivant avec le meme budget borne.
--
-- integration_shipments : endpoint non incremental. Une ligne par integration
-- conserve uniquement l'URL `next` du snapshot afin de parcourir les pages sur
-- plusieurs ticks sans jamais boucler au-dela du budget du cron.

CREATE TABLE public.sendcloud_sync_checkpoints (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource text NOT NULL,
  partition_key text NOT NULL DEFAULT '',
  watermark timestamptz,
  cursor text,
  continuation_url text,
  window_ends_at timestamptz,
  has_more boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, resource, partition_key),
  CONSTRAINT sendcloud_sync_checkpoints_resource CHECK (
    resource IN ('parcels', 'returns', 'integration_shipments')
  ),
  CONSTRAINT sendcloud_sync_checkpoints_shape CHECK (
    (
      resource IN ('parcels', 'returns')
      AND partition_key = ''
      AND watermark IS NOT NULL
      AND continuation_url IS NULL
      AND (
        (has_more AND cursor IS NOT NULL AND window_ends_at IS NOT NULL)
        OR
        (NOT has_more AND cursor IS NULL AND window_ends_at IS NULL)
      )
    )
    OR
    (
      resource = 'integration_shipments'
      AND partition_key ~ '^[0-9]+$'
      AND watermark IS NULL
      AND cursor IS NULL
      AND (
        (has_more AND continuation_url IS NOT NULL AND window_ends_at IS NOT NULL)
        OR
        (NOT has_more AND continuation_url IS NULL AND window_ends_at IS NULL)
      )
    )
  )
);

ALTER TABLE public.sendcloud_sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sendcloud_sync_checkpoints FORCE ROW LEVEL SECURITY;

-- Etat interne du worker uniquement : aucun acces client, meme implicite.
REVOKE ALL ON TABLE public.sendcloud_sync_checkpoints FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sendcloud_sync_checkpoints TO service_role;

CREATE TRIGGER sendcloud_sync_checkpoints_updated_at
  BEFORE UPDATE ON public.sendcloud_sync_checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.sendcloud_sync_checkpoints IS
  'Etat de reprise borne du cron Sendcloud par tenant, ressource et integration.';
COMMENT ON COLUMN public.sendcloud_sync_checkpoints.watermark IS
  'Borne updated_after validee uniquement apres vidage complet du flux incremental.';
COMMENT ON COLUMN public.sendcloud_sync_checkpoints.window_ends_at IS
  'Borne capturee au debut du drain; devient le watermark une fois has_more=false.';
COMMENT ON COLUMN public.sendcloud_sync_checkpoints.continuation_url IS
  'URL next Sendcloud validee cote application pour le snapshot non incremental.';
