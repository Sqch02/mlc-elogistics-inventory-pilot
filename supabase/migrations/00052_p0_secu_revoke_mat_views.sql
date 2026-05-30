-- P0 Security: REVOKE SELECT on the 4 materialized views exposed via PostgREST API.
-- Reason: Postgres does not enforce RLS on materialized views. Granting SELECT to
-- anon/authenticated means any logged-in user can read all tenants' metrics via
-- /rest/v1/<mv>?select=* with their JWT. All app routes use getAdminDb() (service_role)
-- which keeps full access, so this REVOKE has no functional impact on the app.
-- Supabase advisor: materialized_view_in_api x4 (mv_dashboard_daily, mv_sku_metrics,
-- v_physical_shipment_items, mv_shopify_anomaly_items).

REVOKE SELECT ON public.mv_dashboard_daily FROM anon, authenticated;
REVOKE SELECT ON public.mv_sku_metrics FROM anon, authenticated;
REVOKE SELECT ON public.v_physical_shipment_items FROM anon, authenticated;
REVOKE SELECT ON public.mv_shopify_anomaly_items FROM anon, authenticated;

-- Confirm service_role keeps SELECT (admin client used by API routes)
GRANT SELECT ON public.mv_dashboard_daily TO service_role;
GRANT SELECT ON public.mv_sku_metrics TO service_role;
GRANT SELECT ON public.v_physical_shipment_items TO service_role;
GRANT SELECT ON public.mv_shopify_anomaly_items TO service_role;
