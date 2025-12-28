-- Seed data for MLC E-Logistics Inventory Pilot
-- Use this to populate test data for development/testing

-- Note: Run this AFTER creating a user via Supabase Auth
-- The user's ID will need to be inserted into profiles manually

-- 1. Create pilot tenant
INSERT INTO tenants (id, name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'MLC Project (Pilote)')
ON CONFLICT DO NOTHING;

-- 2. Create tenant settings
INSERT INTO tenant_settings (tenant_id, sync_enabled) VALUES
    ('11111111-1111-1111-1111-111111111111', true)
ON CONFLICT DO NOTHING;

-- 3. Create SKUs (5 SKUs as per test plan)
INSERT INTO skus (id, tenant_id, sku_code, name, weight_grams, active) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'SKU-001', 'Widget A - Small', 250, true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'SKU-002', 'Widget B - Medium', 500, true),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'SKU-003', 'Widget C - Large', 1000, true),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'SKU-004', 'Accessory Pack', 150, true),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'BUNDLE-001', 'Starter Kit Bundle', NULL, true)
ON CONFLICT DO NOTHING;

-- 4. Create initial stock
INSERT INTO stock_snapshots (tenant_id, sku_id, qty_current) VALUES
    ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 150),
    ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 75),
    ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 30),
    ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 200),
    ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 25)
ON CONFLICT DO NOTHING;

-- 5. Create bundles (2 bundles as per test plan)
-- Bundle 1: Starter Kit = 1x Widget A + 2x Accessory Pack
INSERT INTO bundles (id, tenant_id, bundle_sku_id) VALUES
    ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
ON CONFLICT DO NOTHING;

INSERT INTO bundle_components (tenant_id, bundle_id, component_sku_id, qty_component) VALUES
    ('11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1),
    ('11111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 2)
ON CONFLICT DO NOTHING;

-- 6. Create locations (5 locations)
INSERT INTO locations (id, tenant_id, code, label, active) VALUES
    ('11111111-2222-3333-4444-555555555551', '11111111-1111-1111-1111-111111111111', 'A-01-01', 'Rack A, Row 1, Bin 1', true),
    ('11111111-2222-3333-4444-555555555552', '11111111-1111-1111-1111-111111111111', 'A-01-02', 'Rack A, Row 1, Bin 2', true),
    ('11111111-2222-3333-4444-555555555553', '11111111-1111-1111-1111-111111111111', 'A-02-01', 'Rack A, Row 2, Bin 1', true),
    ('11111111-2222-3333-4444-555555555554', '11111111-1111-1111-1111-111111111111', 'B-01-01', 'Rack B, Row 1, Bin 1', true),
    ('11111111-2222-3333-4444-555555555555', '11111111-1111-1111-1111-111111111111', 'B-01-02', 'Rack B, Row 1, Bin 2', true)
ON CONFLICT DO NOTHING;

-- 7. Assign SKUs to locations
INSERT INTO location_assignments (tenant_id, location_id, sku_id) VALUES
    ('11111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555551', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ('11111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555552', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('11111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555553', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    ('11111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555554', 'dddddddd-dddd-dddd-dddd-dddddddddddd')
ON CONFLICT DO NOTHING;

-- 8. Create pricing rules
INSERT INTO pricing_rules (tenant_id, carrier, weight_min_grams, weight_max_grams, price_eur) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Colissimo', 0, 250, 4.50),
    ('11111111-1111-1111-1111-111111111111', 'Colissimo', 250, 500, 5.50),
    ('11111111-1111-1111-1111-111111111111', 'Colissimo', 500, 1000, 7.00),
    ('11111111-1111-1111-1111-111111111111', 'Colissimo', 1000, 2000, 9.50),
    ('11111111-1111-1111-1111-111111111111', 'Colissimo', 2000, 5000, 12.00),
    ('11111111-1111-1111-1111-111111111111', 'Chronopost', 0, 500, 8.00),
    ('11111111-1111-1111-1111-111111111111', 'Chronopost', 500, 1000, 10.00),
    ('11111111-1111-1111-1111-111111111111', 'Chronopost', 1000, 3000, 14.00),
    ('11111111-1111-1111-1111-111111111111', 'DPD', 0, 1000, 5.00),
    ('11111111-1111-1111-1111-111111111111', 'DPD', 1000, 5000, 7.50)
ON CONFLICT DO NOTHING;

-- 9. Create mock shipments (10 shipments as per test plan)
INSERT INTO shipments (id, tenant_id, sendcloud_id, shipped_at, carrier, service, weight_grams, order_ref, tracking, pricing_status, computed_cost_eur) VALUES
    ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'SC-001', NOW() - INTERVAL '5 days', 'Colissimo', 'Standard', 320, 'ORD-001', 'FR123456789', 'ok', 5.50),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'SC-002', NOW() - INTERVAL '4 days', 'Colissimo', 'Standard', 180, 'ORD-002', 'FR123456790', 'ok', 4.50),
    ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'SC-003', NOW() - INTERVAL '4 days', 'Chronopost', 'Express', 750, 'ORD-003', 'FR123456791', 'ok', 10.00),
    ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'SC-004', NOW() - INTERVAL '3 days', 'DPD', 'Standard', 1200, 'ORD-004', 'FR123456792', 'ok', 7.50),
    ('22222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111111', 'SC-005', NOW() - INTERVAL '3 days', 'Colissimo', 'Standard', 450, 'ORD-005', 'FR123456793', 'ok', 5.50),
    ('22222222-2222-2222-2222-222222222226', '11111111-1111-1111-1111-111111111111', 'SC-006', NOW() - INTERVAL '2 days', 'Colissimo', 'Standard', 600, 'ORD-006', 'FR123456794', 'ok', 7.00),
    ('22222222-2222-2222-2222-222222222227', '11111111-1111-1111-1111-111111111111', 'SC-007', NOW() - INTERVAL '2 days', 'Chronopost', 'Express', 1500, 'ORD-007', 'FR123456795', 'ok', 14.00),
    ('22222222-2222-2222-2222-222222222228', '11111111-1111-1111-1111-111111111111', 'SC-008', NOW() - INTERVAL '1 day', 'DPD', 'Standard', 800, 'ORD-008', 'FR123456796', 'ok', 5.00),
    ('22222222-2222-2222-2222-222222222229', '11111111-1111-1111-1111-111111111111', 'SC-009', NOW() - INTERVAL '1 day', 'Colissimo', 'Standard', 200, 'ORD-009', 'FR123456797', 'ok', 4.50),
    ('22222222-2222-2222-2222-22222222222a', '11111111-1111-1111-1111-111111111111', 'SC-010', NOW(), 'UPS', 'Express', 3500, 'ORD-010', 'FR123456798', 'missing', NULL)
ON CONFLICT DO NOTHING;

-- 10. Create shipment items for some shipments
INSERT INTO shipment_items (tenant_id, shipment_id, sku_id, qty) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222224', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222225', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222225', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 2),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222226', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222227', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 2)
ON CONFLICT DO NOTHING;

-- 11. Create inbound restock
INSERT INTO inbound_restock (tenant_id, sku_id, qty, eta_date, note) VALUES
    ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 100, CURRENT_DATE + INTERVAL '7 days', 'Commande fournisseur #PO-001'),
    ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 50, CURRENT_DATE + INTERVAL '14 days', 'Commande fournisseur #PO-002')
ON CONFLICT DO NOTHING;

-- 12. Create sample claims
INSERT INTO claims (id, tenant_id, shipment_id, order_ref, status, description, indemnity_eur, decided_at) VALUES
    ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'ORD-001', 'indemnisee', 'Colis endommagé à la livraison', 25.00, NOW() - INTERVAL '3 days'),
    ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', NULL, 'ORD-003', 'en_analyse', 'Colis perdu - en cours de recherche', NULL, NULL),
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222224', 'ORD-004', 'ouverte', 'Retard de livraison signalé', NULL, NULL)
ON CONFLICT DO NOTHING;

-- Done!
-- Note: To complete setup, create a user via Supabase Auth and update their profile:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
