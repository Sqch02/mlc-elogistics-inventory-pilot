-- Batch the read-only SKU resolution performed for Sendcloud parcel items.
-- This removes one PostgREST round trip per item while deliberately reusing
-- map_shipment_item(), so matching order and ambiguity safeguards stay identical.
-- No remap trigger is enabled or invoked by this migration.

CREATE FUNCTION public.map_shipment_items_batch(
  p_tenant_id uuid,
  p_items jsonb
)
RETURNS TABLE(item_index integer, sku_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (item.ordinality - 1)::integer AS item_index,
    public.map_shipment_item(
      p_tenant_id,
      NULLIF(BTRIM(item.value ->> 'raw_sku'), ''),
      NULLIF(BTRIM(item.value ->> 'raw_description'), ''),
      NULLIF(BTRIM(item.value ->> 'raw_variant_id'), '')
    ) AS sku_id
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) = 'array'
        THEN COALESCE(p_items, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS item(value, ordinality);
$function$;

REVOKE EXECUTE ON FUNCTION public.map_shipment_items_batch(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.map_shipment_items_batch(uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.map_shipment_items_batch(uuid, jsonb) TO service_role;
