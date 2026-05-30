-- P0 Security: REVOKE EXECUTE on refresh_* RPCs from anon/authenticated.
-- These should only be called from the server (cron, webhook) via service_role.
-- A logged-in user could otherwise spam refresh_all_analytics_views() and
-- drag the DB down (each call REFRESHes 40 MB of mat views).

REVOKE EXECUTE ON FUNCTION public.refresh_all_analytics_views() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_dashboard_daily() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_physical_items_view() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_shopify_anomaly_items() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_sku_metrics() FROM anon, authenticated;
