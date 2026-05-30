# RPC Definitions Snapshot — 2026-05-30 pre-audit-fixes

Source de vérité prod pour rollback. 28 fonctions dans `public`.

## Observations clés

- **TOUTES les fonctions ont `GRANT EXECUTE TO anon, authenticated`** (cf. grants: `anon=X/postgres, authenticated=X/postgres`). Confirme finding critique #1 audit.
- `handle_new_user` assigne au 1er tenant trouvé (pas via `raw_user_meta_data` comme l'audit le disait — mais risque réel: tout signup ouvert → ops dans le 1er tenant). N'utilise PAS `raw_user_meta_data`.
- `remap_unmapped_items` existe en 2 versions overload:
  - v1 (avec p_limit) → LIMIT COALESCE(p_limit, 2147483647) — fonctionne avec limit
  - v2 (sans p_limit) → AUCUN LIMIT — trigger `trigger_remap_on_mapping_change` appelle CETTE version → risque timeout Florna 670k unmapped
  - Les deux: INSERT `qty_current = -v_item.qty` (créé négatif), `qty - v_item.qty` sans GREATEST(0,...), AUCUN stock_movements inséré, AUCUNE bundle decomposition
- `get_tenant_id()` et `is_super_admin()` EXISTENT dans public schema (audit avait dit "manquants" → FALSE POSITIVE)
- 3 fonctions sans `SET search_path = public`: `get_monthly_indemnities`, `get_shipping_price` (en plus SECURITY INVOKER), `get_all_claims` — confirmé par Supabase advisor
- `refresh_all_analytics_views()` enchaîne 3 REFRESH CONCURRENTLY sans try/catch (cf audit P1)

## Dump complet

Récupéré via `pg_get_functiondef(p.oid)` pour rollback intégral si besoin.
Le dump JSON brut est dans `mcp-supabase-execute_sql-rpcs-1780174719440.json` (sera regénéré au besoin).
