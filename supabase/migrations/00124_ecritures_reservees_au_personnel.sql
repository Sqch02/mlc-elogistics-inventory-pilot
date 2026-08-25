-- Les ecritures deviennent reservees au personnel, pas a tout membre du client.
--
-- CE QUI ETAIT OUVERT
-- Les politiques d'ecriture ne verifiaient que le CLIENT :
--   (tenant_id = get_tenant_id()) OR is_super_admin()
-- Aucune ne regardait le ROLE. Un compte `client` authentifie pouvait donc
-- supprimer les tarifs, les factures, les expeditions ou les articles de son
-- propre client, en s'adressant directement a l'API REST de Supabase.
--
-- Ce n'est pas theorique : 5 comptes `client` sont actifs sur 3 clients, et le
-- navigateur detient une vraie session Supabase. L'interface ne propose pas ces
-- actions, mais l'interface n'est pas une securite.
--
-- CE QUI A ETE VERIFIE AVANT DE RESSERRER
-- Un balayage mecanique des permissions casse la production : c'est ecrit noir
-- sur blanc dans les notes de l'audit des routes. Trois verifications donc :
--   1. AUCUN composant n'ecrit directement depuis le navigateur.
--   2. Les flux client legitimes -- declaration d'arrivage, synchronisation des
--      retours -- passent par le service_role, qui contourne RLS. Les resserrer
--      ne les touche pas.
--   3. La SEULE ecriture par session utilisateur sans garde de role est
--      PATCH /api/profile, en libre-service sur son propre nom.
--
-- `profiles` est donc volontairement EXCLU de cette migration : sa politique
-- actuelle autorise deja la seule modification legitime (id = auth.uid()).
--
-- LE ROLE PLUTOT QUE LA LISTE
-- `is_staff()` teste role <> 'client' au lieu d'enumerer les roles autorises.
-- Un compte `ops` ou `sav` cree demain passera donc sans qu'on ait a repasser
-- ici -- et un oubli d'enumeration ne se verrait qu'au moment ou quelqu'un se
-- retrouve bloque sans comprendre pourquoi.

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = auth.uid();
  -- Un profil absent n'est pas du personnel : en l'absence de preuve, on
  -- refuse. Un visiteur anonyme tombe naturellement dans ce cas.
  RETURN v_role IS NOT NULL AND v_role <> 'client';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated, service_role;

-- bundle_components
DROP POLICY IF EXISTS bundle_components_delete ON public.bundle_components;
CREATE POLICY bundle_components_delete ON public.bundle_components FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS bundle_components_insert ON public.bundle_components;
CREATE POLICY bundle_components_insert ON public.bundle_components FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS bundle_components_update ON public.bundle_components;
CREATE POLICY bundle_components_update ON public.bundle_components FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- bundles
DROP POLICY IF EXISTS bundles_delete ON public.bundles;
CREATE POLICY bundles_delete ON public.bundles FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS bundles_insert ON public.bundles;
CREATE POLICY bundles_insert ON public.bundles FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS bundles_update ON public.bundles;
CREATE POLICY bundles_update ON public.bundles FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- claim_history
DROP POLICY IF EXISTS claim_history_insert ON public.claim_history;
CREATE POLICY claim_history_insert ON public.claim_history FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- claims
DROP POLICY IF EXISTS claims_delete ON public.claims;
CREATE POLICY claims_delete ON public.claims FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS claims_insert ON public.claims;
CREATE POLICY claims_insert ON public.claims FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS claims_update ON public.claims;
CREATE POLICY claims_update ON public.claims FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- dismissed_anomalies
DROP POLICY IF EXISTS dismissed_anomalies_delete ON public.dismissed_anomalies;
CREATE POLICY dismissed_anomalies_delete ON public.dismissed_anomalies FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS dismissed_anomalies_insert ON public.dismissed_anomalies;
CREATE POLICY dismissed_anomalies_insert ON public.dismissed_anomalies FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- inbound_restock
DROP POLICY IF EXISTS inbound_restock_delete ON public.inbound_restock;
CREATE POLICY inbound_restock_delete ON public.inbound_restock FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS inbound_restock_insert ON public.inbound_restock;
CREATE POLICY inbound_restock_insert ON public.inbound_restock FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS inbound_restock_update ON public.inbound_restock;
CREATE POLICY inbound_restock_update ON public.inbound_restock FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- invoice_lines
DROP POLICY IF EXISTS invoice_lines_delete ON public.invoice_lines;
CREATE POLICY invoice_lines_delete ON public.invoice_lines FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS invoice_lines_insert ON public.invoice_lines;
CREATE POLICY invoice_lines_insert ON public.invoice_lines FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS invoice_lines_update ON public.invoice_lines;
CREATE POLICY invoice_lines_update ON public.invoice_lines FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- invoices_monthly
DROP POLICY IF EXISTS invoices_monthly_delete ON public.invoices_monthly;
CREATE POLICY invoices_monthly_delete ON public.invoices_monthly FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS invoices_monthly_insert ON public.invoices_monthly;
CREATE POLICY invoices_monthly_insert ON public.invoices_monthly FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS invoices_monthly_update ON public.invoices_monthly;
CREATE POLICY invoices_monthly_update ON public.invoices_monthly FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- location_assignments
DROP POLICY IF EXISTS location_assignments_delete ON public.location_assignments;
CREATE POLICY location_assignments_delete ON public.location_assignments FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS location_assignments_insert ON public.location_assignments;
CREATE POLICY location_assignments_insert ON public.location_assignments FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS location_assignments_update ON public.location_assignments;
CREATE POLICY location_assignments_update ON public.location_assignments FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- locations
DROP POLICY IF EXISTS locations_delete ON public.locations;
CREATE POLICY locations_delete ON public.locations FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS locations_insert ON public.locations;
CREATE POLICY locations_insert ON public.locations FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS locations_update ON public.locations;
CREATE POLICY locations_update ON public.locations FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- pricing_rules
DROP POLICY IF EXISTS pricing_rules_delete ON public.pricing_rules;
CREATE POLICY pricing_rules_delete ON public.pricing_rules FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS pricing_rules_insert ON public.pricing_rules;
CREATE POLICY pricing_rules_insert ON public.pricing_rules FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS pricing_rules_update ON public.pricing_rules;
CREATE POLICY pricing_rules_update ON public.pricing_rules FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- returns
DROP POLICY IF EXISTS returns_delete ON public.returns;
CREATE POLICY returns_delete ON public.returns FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS returns_insert ON public.returns;
CREATE POLICY returns_insert ON public.returns FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS returns_update ON public.returns;
CREATE POLICY returns_update ON public.returns FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- sendcloud_sku_mappings
DROP POLICY IF EXISTS sendcloud_sku_mappings_delete ON public.sendcloud_sku_mappings;
CREATE POLICY sendcloud_sku_mappings_delete ON public.sendcloud_sku_mappings FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS sendcloud_sku_mappings_insert ON public.sendcloud_sku_mappings;
CREATE POLICY sendcloud_sku_mappings_insert ON public.sendcloud_sku_mappings FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS sendcloud_sku_mappings_update ON public.sendcloud_sku_mappings;
CREATE POLICY sendcloud_sku_mappings_update ON public.sendcloud_sku_mappings FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- shipment_items
DROP POLICY IF EXISTS shipment_items_delete ON public.shipment_items;
CREATE POLICY shipment_items_delete ON public.shipment_items FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS shipment_items_insert ON public.shipment_items;
CREATE POLICY shipment_items_insert ON public.shipment_items FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS shipment_items_update ON public.shipment_items;
CREATE POLICY shipment_items_update ON public.shipment_items FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- shipments
DROP POLICY IF EXISTS shipments_delete ON public.shipments;
CREATE POLICY shipments_delete ON public.shipments FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS shipments_insert ON public.shipments;
CREATE POLICY shipments_insert ON public.shipments FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS shipments_update ON public.shipments;
CREATE POLICY shipments_update ON public.shipments FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- sku_mappings
DROP POLICY IF EXISTS sku_mappings_delete ON public.sku_mappings;
CREATE POLICY sku_mappings_delete ON public.sku_mappings FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS sku_mappings_insert ON public.sku_mappings;
CREATE POLICY sku_mappings_insert ON public.sku_mappings FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS sku_mappings_update ON public.sku_mappings;
CREATE POLICY sku_mappings_update ON public.sku_mappings FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- skus
DROP POLICY IF EXISTS skus_delete ON public.skus;
CREATE POLICY skus_delete ON public.skus FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS skus_insert ON public.skus;
CREATE POLICY skus_insert ON public.skus FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS skus_update ON public.skus;
CREATE POLICY skus_update ON public.skus FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- stock_movements
DROP POLICY IF EXISTS stock_movements_insert ON public.stock_movements;
CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- stock_snapshots
DROP POLICY IF EXISTS stock_snapshots_delete ON public.stock_snapshots;
CREATE POLICY stock_snapshots_delete ON public.stock_snapshots FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS stock_snapshots_insert ON public.stock_snapshots;
CREATE POLICY stock_snapshots_insert ON public.stock_snapshots FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS stock_snapshots_update ON public.stock_snapshots;
CREATE POLICY stock_snapshots_update ON public.stock_snapshots FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- sync_runs
DROP POLICY IF EXISTS sync_runs_delete ON public.sync_runs;
CREATE POLICY sync_runs_delete ON public.sync_runs FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS sync_runs_insert ON public.sync_runs;
CREATE POLICY sync_runs_insert ON public.sync_runs FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS sync_runs_update ON public.sync_runs;
CREATE POLICY sync_runs_update ON public.sync_runs FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );

-- unmapped_items
DROP POLICY IF EXISTS unmapped_items_delete ON public.unmapped_items;
CREATE POLICY unmapped_items_delete ON public.unmapped_items FOR DELETE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS unmapped_items_insert ON public.unmapped_items;
CREATE POLICY unmapped_items_insert ON public.unmapped_items FOR INSERT
  WITH CHECK (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
DROP POLICY IF EXISTS unmapped_items_update ON public.unmapped_items;
CREATE POLICY unmapped_items_update ON public.unmapped_items FOR UPDATE
  USING (
    ((tenant_id = (SELECT public.get_tenant_id())) AND (SELECT public.is_staff()))
    OR (SELECT public.is_super_admin())
  );
