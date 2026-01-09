-- Claims import generated on 2026-01-05 15:59:55.531881
-- Total claims: 1075

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '400493',
  '2025-12-01'::date,
  'cloturee'::claim_status,
  'Début le 01/12/2025',
  'Tracking: U61000008864'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '400493'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388087',
  '2025-11-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83594750'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388087'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349455',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349455'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333241',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333241'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '321614',
  '2025-08-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '321614'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391197',
  '2025-12-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22123922748'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391197'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387763',
  '2025-11-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22045858972'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387763'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349408',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349408'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '327378',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '327378'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '323275',
  '2025-08-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '323275'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402309',
  '2025-12-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36179911496'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402309'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373836',
  '2025-11-01'::date,
  'cloturee'::claim_status,
  'Quentin : U61000007267',
  'Tracking: 9L36108171915'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373836'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350288',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350288'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335384',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335384'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '329294',
  '2025-08-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '329294'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402069',
  '2025-12-01'::date,
  'cloturee'::claim_status,
  'Fin 01/12/02025',
  'Tracking: LD230565647FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402069'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380324',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83631488'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380324'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '323932',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '323932'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334544',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334544'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '327272',
  '2025-08-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '327272'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405306',
  '2025-12-01'::date,
  'cloturee'::claim_status,
  'début 02/12/2025',
  'Tracking: U84300000109'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405306'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '385741',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36108171915'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '385741'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358387',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358387'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338931',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338931'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '320953',
  '2025-08-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '320953'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398023',
  '2025-12-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36181999802'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398023'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387099',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007268'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387099'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '362800',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '362800'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334734',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334734'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '325314',
  '2025-08-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '325314'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392707',
  '2025-12-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000110'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392707'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '384700',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001290'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '384700'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '366313',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '366313'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339134',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339134'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335587',
  '2025-08-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335587'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406383',
  '2025-12-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22129892281'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406383'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371503',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007269'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371503'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358499',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358499'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332214',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332214'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336083',
  '2025-08-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336083'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402025',
  '2025-12-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36188043416'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402025'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380473',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83650630'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380473'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '361938',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '361938'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343171',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343171'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332826',
  '2025-08-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332826'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382818',
  '2025-12-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86602469'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382818'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388300',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36116175813'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388300'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337804',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337804'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341345',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341345'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333676',
  '2025-08-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333676'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407189',
  '2025-12-02'::date,
  'cloturee'::claim_status,
  'fin 02/12/2025',
  'Tracking: U84300000319'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407189'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386048',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36113175236'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386048'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360244',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360244'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '344624',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '344624'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332580',
  '2025-08-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332580'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396435',
  '2025-12-02'::date,
  'cloturee'::claim_status,
  'début 03/12/2025',
  'Tracking: `U84300000320'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396435'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380059',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007271'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380059'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364916',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364916'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334892',
  '2025-09-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334892'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333698',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333698'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404797',
  '2025-12-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000321'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404797'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380061',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007270'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380061'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '368168',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '368168'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340921',
  '2025-09-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340921'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333873',
  '2025-08-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333873'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395716',
  '2025-12-02'::date,
  'cloturee'::claim_status,
  'fin 03/12/2025',
  'Tracking: 9L36186120454'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395716'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '383176',
  '2025-11-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007272'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '383176'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359523',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359523'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '327983',
  '2025-09-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '327983'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334956',
  '2025-08-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334956'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406469',
  '2025-12-03'::date,
  'cloturee'::claim_status,
  'début le 04/12/2025',
  'Tracking: 6M22132233613'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406469'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387419',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22047924231'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387419'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369860',
  '2025-10-01'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369860'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332778',
  '2025-09-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332778'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331964',
  '2025-08-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331964'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404459',
  '2025-12-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36180156985'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404459'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '384941',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 83708955'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '384941'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343413',
  '2025-09-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343413'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333827',
  '2025-08-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333827'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406892',
  '2025-12-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000392'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406892'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380366',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000007288'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380366'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369948',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369948'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339037',
  '2025-09-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339037'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337346',
  '2025-08-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337346'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404854',
  '2025-12-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22132342940'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404854'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '385159',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 9L36104211028'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '385159'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369652',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369652'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343965',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343965'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336283',
  '2025-08-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336283'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408768',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22132576215'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408768'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382593',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22046725082'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382593'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342913',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342913'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333114',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333114'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332136',
  '2025-08-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332136'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401719',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000397'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401719'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387336',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22045928057'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387336'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '366579',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '366579'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343071',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343071'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332390',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332390'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401750',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22134165998'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401750'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387338',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22044327684'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387338'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336847',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336847'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342084',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342084'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '325736',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '325736'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401892',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36180252458'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401892'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387835',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22047924590'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387835'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370096',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370096'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '319718',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '319718'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332851',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332851'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398611',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 9L36188253075'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398611'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388061',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22044328605'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388061'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370080',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370080'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338420',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338420'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333847',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333847'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399377',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000436'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399377'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '377542',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36108214681'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '377542'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369735',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369735'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336532',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336532'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334041',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334041'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406208',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000438'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406208'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379152',
  '2025-11-03'::date,
  'cloturee'::claim_status,
  'Fin le 03/11/2025',
  'Tracking: 9L36106225597'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379152'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '368635',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '368635'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334531',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334531'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '324243',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '324243'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401288',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'fin le 04/12/2025',
  'Tracking: 9L36187256053'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401288'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389955',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Début 04/11/2025',
  'Tracking: U61000007342'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389955'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371176',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371176'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331578',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331578'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336434',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336434'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406497',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'début 05/12/2025',
  'Tracking: U84300000477'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406497'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389848',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Par Quentin. FIN le 04/11/2025',
  'Tracking: 83815415'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389848'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360544',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360544'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345684',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345684'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '328024',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '328024'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402692',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000478'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402692'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389085',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Début 06/11/2025',
  'Tracking: 83825508'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389085'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364093',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364093'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334372',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334372'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '328063',
  '2025-08-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '328063'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '394130',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86912634'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '394130'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386076',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83825541'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386076'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '368431',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '368431'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332396',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332396'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '320142',
  '2025-08-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '320142'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406464',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD231313928FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406464'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389341',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007396'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389341'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352869',
  '2025-10-02'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352869'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334577',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334577'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '324384',
  '2025-08-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '324384'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401886',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000479'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401886'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389875',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83830413'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389875'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370624',
  '2025-10-03'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370624'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338750',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338750'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334759',
  '2025-08-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334759'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409497',
  '2025-12-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86920552'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409497'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386510',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22045242399'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386510'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360501',
  '2025-10-03'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360501'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339215',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339215'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '328926',
  '2025-08-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '328926'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407401',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36180340414'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407401'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387867',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36112309588'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387867'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359907',
  '2025-10-03'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359907'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339576',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339576'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332001',
  '2025-08-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332001'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406415',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86964500'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406415'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336492',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001340'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336492'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370203',
  '2025-10-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370203'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349398',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349398'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '322741',
  '2025-08-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '322741'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408405',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U84300000557'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408405'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373316',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83856000'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373316'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369850',
  '2025-10-03'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369850'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343952',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343952'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331847',
  '2025-08-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331847'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408330',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U84300000559'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408330'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386137',
  '2025-11-04'::date,
  'cloturee'::claim_status,
  'FIN le 05/11/2025',
  'Tracking: 6H14107019773'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386137'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340643',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340643'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333344',
  '2025-08-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333344'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409245',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22133928952'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409245'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '383506',
  '2025-11-05'::date,
  'cloturee'::claim_status,
  '"Début 06/11/2025',
  'Tracking: 83902038'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '383506'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370044',
  '2025-10-03'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370044'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342827',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342827'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332764',
  '2025-08-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332764'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409223',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 409223'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409223'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369367',
  '2025-11-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD227698317FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369367'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352606',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352606'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337534',
  '2025-09-03'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337534'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334794',
  '2025-08-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334794'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409200',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Par Quentin. fin 05/12/2025',
  'Tracking: U84300000566'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409200'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382392',
  '2025-11-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36104341756'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382392'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359923',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359923'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335555',
  '2025-08-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335555'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401556',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'début 08/12/2025',
  'Tracking: U84300000592'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401556'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '384338',
  '2025-11-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007455'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '384338'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356386',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356386'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340805',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340805'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '327477',
  '2025-08-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '327477'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406890',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22134778198'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406890'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373344',
  '2025-11-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007456'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373344'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '361159',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '361159'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336073',
  '2025-08-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336073'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396391',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87039775'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396391'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372152',
  '2025-11-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007457'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372152'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370782',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370782'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349452',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349452'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338378',
  '2025-08-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338378'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408228',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36190083967'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408228'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389186',
  '2025-11-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36121131347'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389186'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370760',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370760'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332665',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332665'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '325346',
  '2025-08-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '325346'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408359',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000593'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408359'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '#385299',
  '2025-11-06'::date,
  'cloturee'::claim_status,
  'Quentin : Je ne vois pas la partie "Historique" dans l''étiquette, bien vérifier avant envoi svp, si non, dupliquer à nouveau l''étiquette en cochant la case "nouvel envoi" merci',
  'Tracking: 83993690'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '#385299'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369869',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369869'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332205',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332205'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '321648',
  '2025-08-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '321648'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '384725',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87042616'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '384725'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389034',
  '2025-11-06'::date,
  'cloturee'::claim_status,
  'FIN le 06/11/2025',
  'Tracking: 83996375'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389034'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371654',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371654'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '328582',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '328582'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '320674',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '320674'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406783',
  '2025-12-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000594'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406783'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388450',
  '2025-11-06'::date,
  'cloturee'::claim_status,
  '"Début 07/11/2025',
  'Tracking: 84034162'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388450'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '355579',
  '2025-10-05'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '355579'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334387',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334387'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336108',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336108'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406135',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000595'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406135'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391823',
  '2025-11-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001374'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391823'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364094',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364094'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '344558',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '344558'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335579',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335579'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '400517',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000596'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '400517'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376563',
  '2025-11-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007524'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376563'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370738',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370738'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332920',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332920'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336171',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336171'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405870',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22135403259'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405870'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '390816',
  '2025-11-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84078712'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '390816'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370850',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370850'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337770',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337770'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336329',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336329'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401715',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36180440893'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401715'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370026',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'X',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370026'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345369',
  '2025-08-04'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345369'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '327999',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '327999'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409832',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000597'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409832'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391074',
  '2025-11-07'::date,
  'cloturee'::claim_status,
  'FIN le 07/11/2025',
  'Tracking: 84080393'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391074'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369531',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'DEBUT 07/10',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369531'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '324397',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '324397'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331785',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331785'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407787',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22135826324'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407787'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392185',
  '2025-11-07'::date,
  'cloturee'::claim_status,
  'Par Quentin. Début 10/11/2025',
  'Tracking: 84095636'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392185'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370803',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370803'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333207',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333207'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '330247',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '330247'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407773',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87128197'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407773'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '390929',
  '2025-11-07'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 84095773'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '390929'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358172',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358172'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336938',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336938'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333112',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333112'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408876',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87129836'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408876'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387266',
  '2025-11-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007558'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387266'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '368868',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '368868'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338498',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338498'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332679',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332679'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407481',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87131054'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407481'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391482',
  '2025-11-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84113761'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391482'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370700',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370700'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345679',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345679'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335259',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335259'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407138',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000598'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407138'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380430',
  '2025-11-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84137867'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380430'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358247',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358247'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '347440',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '347440'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337887',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337887'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410275',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87142607'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410275'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349967',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349967'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '319310',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '319310'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333549',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333549'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410861',
  '2025-12-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000599'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410861'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392070',
  '2025-11-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84168847'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392070'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364754',
  '2025-10-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364754'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '351857',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '351857'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334224',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334224'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '400229',
  '2025-12-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36186468570'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '400229'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392149',
  '2025-11-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007578'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392149'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343089',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343089'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341858',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341858'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333837',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333837'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407966',
  '2025-12-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22135653593'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407966'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '381731',
  '2025-11-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36119310419'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '381731'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369930',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369930'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '346354',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '346354'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337596',
  '2025-08-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337596'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408832',
  '2025-12-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87181990'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408832'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391311',
  '2025-11-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD228073414FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391311'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '357181',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '357181'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342110',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342110'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '330834',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '330834'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408611',
  '2025-12-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000600'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408611'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392579',
  '2025-11-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83904782'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392579'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '362332',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '362332'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333524',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333524'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336700',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336700'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410428',
  '2025-12-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000601'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410428'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389394',
  '2025-11-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84289485'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389394'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358064',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358064'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350319',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350319'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337342',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337342'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402317',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000602'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402317'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392548',
  '2025-11-10'::date,
  'cloturee'::claim_status,
  'FIN le 10/11/2025',
  'Tracking: 83904687'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392548'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369312',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369312'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353658',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353658'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334401',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334401'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407988',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'fin 08/12/2025',
  'Tracking: U84300000630'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407988'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391520',
  '2025-11-10'::date,
  'cloturee'::claim_status,
  'Début 12/11/2025',
  'Tracking: U61000007625'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391520'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371460',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371460'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '329219',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '329219'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337339',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337339'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399119',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin. début le 09/12/2025',
  'Tracking: LD231758326FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399119'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382645',
  '2025-11-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22051870166'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382645'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371795',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Fin 07/10/2025',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371795'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340804',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340804'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341239',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341239'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409093',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: LD231758944FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409093'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388111',
  '2025-11-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007706'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388111'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358557',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'debut 09/10/25',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358557'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '346555',
  '2025-09-05'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '346555'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '327756',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '327756'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408932',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: LD231760109FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408932'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386891',
  '2025-11-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84412185'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386891'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370728',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370728'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340761',
  '2025-09-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340761'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408877',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: LD231760660FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408877'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '385731',
  '2025-11-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007708'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '385731'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '354699',
  '2025-10-07'::date,
  'cloturee'::claim_status,
  'Fin 09/10/2025',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '354699'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '320519',
  '2025-09-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '320519'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335434',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335434'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407354',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: LD231761166FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407354'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387168',
  '2025-11-11'::date,
  'cloturee'::claim_status,
  'FIN le 12/11/2025',
  'Tracking: U61000007707'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387168'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '363879',
  '2025-10-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '363879'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343963',
  '2025-09-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343963'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '321102',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '321102'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407067',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: LD231761719FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407067'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387284',
  '2025-11-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84457100'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387284'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372091',
  '2025-10-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372091'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '329506',
  '2025-09-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '329506'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331293',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331293'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408828',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: LD231762127FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408828'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343161',
  '2025-10-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343161'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331790',
  '2025-09-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331790'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '327264',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '327264'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395103',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin. Elle est en "non traitée" sur shopify, pouvez-vous y ajouter le numéro de suivi svp',
  'Tracking: LD231877133FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395103'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396104',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'FIN le 13/11/2025',
  'Tracking: U61000007769'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396104'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360012',
  '2025-10-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360012'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '346959',
  '2025-09-06'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '346959'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341301',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341301'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391286',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Par Quentin. Elle est en "non traitée" sur shopify, pouvez-vous y ajouter le numéro de suivi svp',
  'Tracking: 8Q54042253146'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391286'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391816',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Début 14/11/2025',
  'Tracking: U61000007784'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391816'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372139',
  '2025-10-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372139'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337389',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337389'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335431',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335431'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392020',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87409356'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392020'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389933',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84596153'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389933'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343324',
  '2025-10-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343324'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349008',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349008'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340417',
  '2025-08-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340417'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410431',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000895'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410431'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395201',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84596946'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395201'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371240',
  '2025-10-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371240'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337230',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337230'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340138',
  '2025-08-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340138'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '385558',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007849'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '385558'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338013',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338013'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342726',
  '2025-08-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342726'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410822',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87342094'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410822'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388920',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84610058'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388920'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341480',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341480'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333828',
  '2025-08-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333828'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401332',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000897'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401332'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388826',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84610336'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388826'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '368760',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '368760'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337358',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337358'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343072',
  '2025-08-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343072'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410542',
  '2025-12-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22136833093'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410542'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389597',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84611270'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389597'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '367503',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '367503'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '347164',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '347164'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339163',
  '2025-08-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339163'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410777',
  '2025-12-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000898'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410777'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397540',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84617201'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397540'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370567',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370567'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332259',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332259'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341111',
  '2025-08-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341111'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411542',
  '2025-12-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000992'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411542'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387832',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36155637013'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387832'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370733',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370733'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333683',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333683'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340947',
  '2025-08-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340947'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397939',
  '2025-12-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD231908476FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397939'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392116',
  '2025-11-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007851'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392116'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350955',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350955'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333831',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333831'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333339',
  '2025-08-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333339'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '363814',
  '2025-12-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300000993'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '363814'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389195',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36147651980'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389195'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '330 001',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '330 001'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334520',
  '2025-08-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334520'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410598',
  '2025-12-09'::date,
  'cloturee'::claim_status,
  'fin le 09/12/2025',
  'Tracking: 87422149'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410598'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380348',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84659579'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380348'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332328',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332328'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337880',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337880'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409465',
  '2025-12-09'::date,
  'cloturee'::claim_status,
  'début le 10/12/2025',
  'Tracking: 6M22136759508'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409465'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396235',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84661133'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396235'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353867',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353867'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337452',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337452'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334823',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334823'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411290',
  '2025-12-09'::date,
  'cloturee'::claim_status,
  'fin le 10/12/2025',
  'Tracking: 6M22136564331'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411290'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389144',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36156651353'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389144'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '357170',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '357170'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '327235',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '327235'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335778',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335778'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411816',
  '2025-12-10'::date,
  'cloturee'::claim_status,
  'début le 11/12/25',
  'Tracking: U84300001083'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411816'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373314',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84664450'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373314'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335957',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335957'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332025',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332025'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340864',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340864'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410201',
  '2025-12-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22138587444'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410201'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380811',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD228429679FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380811'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352307',
  '2025-09-07'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352307'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332523',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332523'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411243',
  '2025-12-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22138808471'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411243'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '385933',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD228568959FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '385933'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353 282',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353 282'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332841',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332841'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409914',
  '2025-12-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001095'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409914'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389557',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36156658727'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389557'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341440',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341440'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '322835',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '322835'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403772',
  '2025-12-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36192949162'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403772'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379840',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD228573830FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379840'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364115',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364115'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '355136',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '355136'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331835',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331835'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409553',
  '2025-12-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001096'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409553'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342852',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342852'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349498',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349498'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343711',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343711'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410266',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001742'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410266'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397064',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'début le 17/11/2025',
  'Tracking: 84671779'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397064'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '309741',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '309741'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352284',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352284'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338629',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338629'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405871',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001097'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405871'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391283',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84689679'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391283'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364164',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364164'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '351972',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '351972'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331510',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331510'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391463',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22138295974'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391463'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392033',
  '2025-11-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22069639182'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392033'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '354973',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '354973'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353700',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353700'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '348295',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '348295'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406111',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36192474664'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406111'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392858',
  '2025-11-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84736802'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392858'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364425',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364425'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334816',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334816'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334634',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334634'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412192',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001115'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412192'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '390002',
  '2025-11-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007926'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '390002'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371684',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371684'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352300',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352300'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '347236',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '347236'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412393',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001749'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412393'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '393737',
  '2025-11-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007928'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '393737'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373945',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373945'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334428',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334428'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '344292',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '344292'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395634',
  '2025-11-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007931'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395634'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371669',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371669'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353255',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353255'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333889',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333889'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413173',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001754'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413173'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '390163',
  '2025-11-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007930'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '390163'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371652',
  '2025-10-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371652'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '344640',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '344640'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332748',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332748'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413085',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36192486179'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413085'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395953',
  '2025-11-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84813179'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395953'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371733',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371733'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350716',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350716'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340581',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340581'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411420',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'fin le 11/12/25',
  'Tracking: 87656826'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411420'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395239',
  '2025-11-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007932'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395239'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370978',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370978'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343511',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343511'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339357',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339357'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409221',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'début le 12/12/25',
  'Tracking: 87676854'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409221'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '393636',
  '2025-11-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36153725675'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '393636'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375125',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375125'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333885',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333885'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339767',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339767'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412208',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U84300001195'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412208'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389264',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007934'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389264'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371637',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371637'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '330657',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '330657'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338237',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338237'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412693',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD232327778FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412693'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398985',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007937'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398985'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373267',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373267'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337471',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337471'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336648',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336648'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408845',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36193033488'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408845'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398478',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22066170817'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398478'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371514',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371514'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342223',
  '2025-08-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342223'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408802',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36190568518'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408802'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '394263',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84912153'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '394263'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371089',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371089'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336604',
  '2025-09-08'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336604'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412065',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001196'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412065'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399012',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'fin le 17/11/2025',
  'Tracking: 9L36147799736'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399012'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373147',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373147'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356366',
  '2025-09-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356366'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410111',
  '2025-12-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001197'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410111'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389604',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'début le 18/11/2025',
  'Tracking: 9L36150817083'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389604'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372119',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'FIN 10/10 f',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372119'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '330283',
  '2025-09-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: bigblue'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '330283'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408263',
  '2025-12-12'::date,
  'cloturee'::claim_status,
  'Fin le 12/12/2025',
  'Tracking: LD232380535FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408263'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396140',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 84954939'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396140'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345994',
  '2025-09-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345994'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408866',
  '2025-12-12'::date,
  'cloturee'::claim_status,
  'Par Quentin. Quentin a prévenu HME le vendredi début le 12/12/25',
  'Tracking: LD232453630FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408866'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396660',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36152819603'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396660'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369814',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 81429129'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369814'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411526',
  '2025-12-12'::date,
  'cloturee'::claim_status,
  'Par Quentin. Quentin a prévenu HME le vendredi Fin le 12/12/2025',
  'Tracking: LD232453759FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411526'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '393219',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 84960203'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '393219'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372358',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000006002'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372358'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412753',
  '2025-12-13'::date,
  'cloturee'::claim_status,
  'début le 15/12/25',
  'Tracking: 87917322'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412753'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380020',
  '2025-11-17'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 84960348'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380020'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339882',
  '2025-09-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339882'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410350',
  '2025-12-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001300'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410350'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396254',
  '2025-11-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008025'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396254'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350547',
  '2025-09-09'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350547'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407655',
  '2025-12-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22141498102'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407655'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '394173',
  '2025-11-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008030'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '394173'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392662',
  '2025-12-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001301'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392662'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391921',
  '2025-11-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008038'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391921'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340989',
  '2025-09-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340989'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414276',
  '2025-12-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001302'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414276'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398054',
  '2025-11-18'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22070249394'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398054'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342524',
  '2025-09-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342524'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413878',
  '2025-12-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 87880938'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413878'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398908',
  '2025-11-18'::date,
  'cloturee'::claim_status,
  'Par Quentin. fin le 18/11/2025',
  'Tracking: U61100001551'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398908'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335383',
  '2025-09-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335383'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398627',
  '2025-11-18'::date,
  'cloturee'::claim_status,
  'début le 19/11/2025',
  'Tracking: 85055736'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398627'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343843',
  '2025-09-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343843'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411607',
  '2025-12-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001768'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411607'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380353',
  '2025-11-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85058160'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380353'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '347617',
  '2025-09-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '347617'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404634',
  '2025-12-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001304'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404634'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397251',
  '2025-11-18'::date,
  'cloturee'::claim_status,
  'fin le 19/11/2025',
  'Tracking: 85065326'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397251'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '394149',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Par Quentin. début le 20/11/2025',
  'Tracking: 9L36157904458'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '394149'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333173',
  '2025-09-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333173'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411041',
  '2025-12-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001305'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411041'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '390402',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000008108'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '390402'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349632',
  '2025-09-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349632'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405200',
  '2025-12-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36193186894'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405200'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389872',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Par Quentin. vol de remorque',
  'Tracking: 85100997'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389872'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374941',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: LD225308711FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374941'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332855',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332855'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410396',
  '2025-12-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22140753837'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410396'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388963',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Par Quentin. vol de remorque',
  'Tracking: 9L36147912173'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388963'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399580',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36192227925'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399580'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388983',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Par Quentin. vol de remorque',
  'Tracking: 85101318'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388983'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333174',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333174'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413828',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001306'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413828'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '#336492',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Faite par Audrey',
  'Tracking: U61100001561'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '#336492'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338018',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338018'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411929',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001310'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411929'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '#392333',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85105954'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '#392333'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '346136',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '346136'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403381',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'fin le 15/12/2025',
  'Tracking: U84300001333'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403381'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399682',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22069938841'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399682'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334843',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334843'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406094',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'début le 16/12/25',
  'Tracking: 9L36192239263'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406094'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '400554',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22069553525'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '400554'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343507',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343507'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414538',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36200801758'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414538'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396279',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85145365'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396279'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335966',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335966'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413491',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22152858902'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413491'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399461',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85151004'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399461'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '344213',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '344213'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413398',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U84300001552'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413398'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '389895',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85161664'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '389895'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374393',
  '2025-10-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82023326'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374393'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336122',
  '2025-09-10'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336122'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413474',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 88075753'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413474'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397896',
  '2025-11-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22075173007'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397896'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375123',
  '2025-10-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82048224'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375123'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '354939',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '354939'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403727',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22141873015'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403727'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373771',
  '2025-10-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22016017285'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373771'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358275',
  '2025-09-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358275'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414971',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61100001789'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414971'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398777',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008157'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398777'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352342',
  '2025-10-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82048721'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352342'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334556',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334556'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407857',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36199822482'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407857'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '391265',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008199'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '391265'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376308',
  '2025-10-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 81819837'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376308'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342978',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342978'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414775',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001601'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414775'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392047',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 6M22075209256'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392047'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358537',
  '2025-10-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82049341'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358537'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335905',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335905'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408944',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001603'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408944'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398904',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000008204'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398904'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369923',
  '2025-10-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006346'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369923'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337661',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337661'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409749',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001602'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409749'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396044',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85204350'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396044'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374231',
  '2025-10-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 81821861'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374231'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345747',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345747'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407173',
  '2025-12-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001604'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407173'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397006',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'fin le 20/11/2025',
  'Tracking: U61000008224'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397006'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374923',
  '2025-10-11'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22016430237'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374923'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352957',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352957'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '415463',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001605'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '415463'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401630',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'début le 21/11/2025',
  'Tracking: 6M22075246220'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401630'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337647',
  '2025-10-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82091332'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337647'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408027',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: QH6400000205'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408027'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '400522',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85268856'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '400522'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372257',
  '2025-10-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82093006'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372257'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342394',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342394'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410378',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'fin le 16/12/2025',
  'Tracking: U84300001623'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410378'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397610',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD229270985FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397610'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370649',
  '2025-10-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006348'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370649'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '347036',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '347036'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408129',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'début le 17/12/25',
  'Tracking: 8Q54042101447'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408129'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392270',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85271525'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392270'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376441',
  '2025-10-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82093275'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376441'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341675',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341675'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '415423',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 88176921'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '415423'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '400243',
  '2025-11-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85272335'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '400243'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '361657',
  '2025-10-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006349'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '361657'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335787',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335787'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411696',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 88177175'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411696'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '393952',
  '2025-11-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008226'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '393952'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374752',
  '2025-10-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 81823691'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374752'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337473',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337473'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405794',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD232902775FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405794'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380471',
  '2025-11-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008227'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380471'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371605',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82144543'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371605'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345316',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345316'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332927',
  '2025-11-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85335454'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332927'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376124',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 81819258'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376124'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416085',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001697'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416085'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397629',
  '2025-11-21'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 85343888'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397629'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371772',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82151367'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371772'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '357149',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '357149'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403888',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36201423898'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403888'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401495',
  '2025-11-21'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 85344253'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401495'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340670',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340670'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '388791',
  '2025-12-16'::date,
  'cloturee'::claim_status,
  'fin le 17/12/2025',
  'Tracking: U84300001698'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '388791'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398258',
  '2025-11-21'::date,
  'cloturee'::claim_status,
  'fin le 21/11/2025',
  'Tracking: U61100001579'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398258'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371719',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82153030'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371719'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356193',
  '2025-09-12'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356193'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416911',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'début le 18/12/25',
  'Tracking: 88277967'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416911'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '400141',
  '2025-11-21'::date,
  'cloturee'::claim_status,
  'début le 24/11/2025',
  'Tracking: 6H14116359990'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '400141'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371736',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006377'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371736'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339782',
  '2025-09-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339782'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414856',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001739'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414856'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397601',
  '2025-11-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85396241'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397601'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375517',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 81827605'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375517'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '332410',
  '2025-09-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '332410'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414187',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 88285332'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414187'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398993',
  '2025-11-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85435362'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398993'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376370',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 81816023'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376370'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338323',
  '2025-09-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338323'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407641',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001791'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407641'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395861',
  '2025-11-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008316'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395861'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '369383',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36022088023'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '369383'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337162',
  '2025-09-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337162'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412829',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001792'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412829'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386738',
  '2025-11-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85439232'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386738'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '368691',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006393'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '368691'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '348706',
  '2025-09-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '348706'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406363',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001793'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406363'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397443',
  '2025-11-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008317'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397443'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371597',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22012916353'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371597'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337016',
  '2025-09-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337016'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412782',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001794'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412782'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395964',
  '2025-11-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22074954669'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395964'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359938',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Par Quentin. Fin 13/10/2025 P Commande bloquée dans "commande importée", à envoyer svp',
  'Tracking: 82185234'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359938'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339101',
  '2025-09-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339101'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401123',
  '2025-11-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22072960174'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401123'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '347912',
  '2025-09-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '347912'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409538',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001796'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409538'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396045',
  '2025-11-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6H14116790168'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396045'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360446',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: LD225923240FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360446'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338537',
  '2025-09-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338537'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '409167',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36200527344'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '409167'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401118',
  '2025-11-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22077364298'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401118'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412731',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001797'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412731'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '400246',
  '2025-11-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008318'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '400246'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '328340',
  '2025-09-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '328340'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413725',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001798'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413725'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333378',
  '2025-09-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333378'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412792',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001799'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412792'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401870',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22076218516'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401870'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343782',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000006522'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343782'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '348319',
  '2025-09-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '348319'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408097',
  '2025-12-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001800'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408097'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395108',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008319'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395108'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '347999',
  '2025-09-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '347999'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413347',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001801'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413347'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399443',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85572902'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399443'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '348973',
  '2025-09-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '348973'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416567',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'fin le 18/12/2025',
  'Tracking: U84300001808'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416567'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399306',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008376'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399306'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331297',
  '2025-09-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331297'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416940',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'début le 19/12/25',
  'Tracking: 88392067'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416940'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395814',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85574809'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395814'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337173',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337173'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413209',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001864'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413209'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402230',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000008382'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402230'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349783',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349783'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411047',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 88397118'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411047'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '394476',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008393'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '394476'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352997',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352997'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408207',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001894'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408207'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '385908',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'fin le 24/11/2025',
  'Tracking: 85592912'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '385908'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353894',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353894'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '415113',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U84300001898'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '415113'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403593',
  '2025-11-24'::date,
  'cloturee'::claim_status,
  'début le 25/11/2025',
  'Tracking: 6M22074316405'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403593'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338469',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338469'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414907',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001916'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414907'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392165',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22074355794'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392165'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '331567',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '331567'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402211',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36171419891'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402211'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345297',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345297'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416665',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001917'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416665'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403172',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36170422649'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403172'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337684',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337684'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '417592',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22155226241'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '417592'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402695',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22118766005'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402695'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353355',
  '2025-09-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353355'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '411529',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001918'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '411529'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '286960',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '286960'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '418138',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001919'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '418138'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402528',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000008546'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402528'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372840',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Début 15/10/2025',
  'Tracking: U61000006428'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372840'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '413481',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 88449562'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '413481'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403598',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'Par Quentin. fin le 25/11/2025',
  'Tracking: 6M22119378078'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403598'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '363393',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82203178'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '363393'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349355',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349355'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410634',
  '2025-12-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001920'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410634'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402711',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'début le 26/11/2025',
  'Tracking: U61000008562'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402711'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345779',
  '2025-10-13'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006429'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345779'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359181',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359181'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416303',
  '2025-12-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6H14143619937'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416303'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404802',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008563'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404802'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371408',
  '2025-10-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006430'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371408'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '351876',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '351876'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '408507',
  '2025-12-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300001921'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '408507'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401740',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36169486652'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401740'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374386',
  '2025-10-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22012171875'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374386'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '317024',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '317024'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '417479',
  '2025-12-19'::date,
  'cloturee'::claim_status,
  'Par Quentin. fin le 19/12/2025',
  'Tracking: 6M22155253261'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '417479'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402779',
  '2025-11-25'::date,
  'cloturee'::claim_status,
  'fin le 26/11/2025',
  'Tracking: U61100001619'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402779'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370486',
  '2025-10-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006450'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370486'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356988',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356988'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '415963',
  '2025-12-19'::date,
  'cloturee'::claim_status,
  'début le 22/12/2025',
  'Tracking: 6H14143350281'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '415963'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396754',
  '2025-11-26'::date,
  'cloturee'::claim_status,
  'début le 27/11/2025',
  'Tracking: U61000008611'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396754'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374314',
  '2025-10-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82273869'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374314'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359564',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359564'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416586',
  '2025-12-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22155095489'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416586'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404718',
  '2025-11-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008633'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404718'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360385',
  '2025-10-14'::date,
  'cloturee'::claim_status,
  'Par Quentin. Pour Audrey : A recréer manuellement dans sendcloud stp car elle a disparu de sendcloud et ils n''arrivent pas à la remettre, merci',
  'Tracking: U61000006497'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360385'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334279',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334279'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '417243',
  '2025-12-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6H14143634961'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '417243'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '394303',
  '2025-11-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008634'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '394303'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372121',
  '2025-10-14'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22016207983'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372121'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349885',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349885'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '418240',
  '2025-12-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 88557044'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '418240'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404627',
  '2025-11-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22118943130'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404627'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '351088',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '351088'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401697',
  '2025-12-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: CB455090823FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401697'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404234',
  '2025-11-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008635'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404234'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '344925',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '344925'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414832',
  '2025-12-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002004'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414832'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '394184',
  '2025-11-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008636'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '394184'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349332',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349332'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414237',
  '2025-12-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002005'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414237'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402395',
  '2025-11-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 85895358'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402395'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375469',
  '2025-10-15'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 82336206'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375469'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '351056',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '351056'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416995',
  '2025-12-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002006'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416995'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399970',
  '2025-11-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD230005660FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399970'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342910',
  '2025-09-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342910'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414780',
  '2025-12-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002007'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414780'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404279',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 85947055'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404279'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343142',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343142'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '412341',
  '2025-12-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002008'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '412341'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404913',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 85947178'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404913'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359157',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359157'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416574',
  '2025-12-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36213784024'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416574'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403211',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008673'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403211'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352607',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352607'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398687',
  '2025-12-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002009'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398687'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398642',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'fin le 27/11/2025',
  'Tracking: U61000008680'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398642'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '418745',
  '2025-12-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22159783399'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '418745'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396357',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'début le 28/11/2025',
  'Tracking: U61000008721'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396357'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '352373',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '352373'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '419221',
  '2025-12-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002010'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '419221'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398924',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86003638'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398924'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375627',
  '2025-10-15'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 82338078'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375627'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333350',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333350'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416118',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002112'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416118'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376251',
  '2025-10-15'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 82338572'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376251'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353653',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353653'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416240',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002011'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416240'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403093',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36179633534'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403093'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371697',
  '2025-10-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82343769'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371697'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '414173',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002015'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '414173'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404993',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008722'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404993'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371634',
  '2025-10-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82346937'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371634'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360231',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360231'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399863',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: QH6400000267'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399863'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404141',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86021981'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404141'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378684',
  '2025-10-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006528'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378684'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359761',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359761'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '415846',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: LD233401568FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '415846'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402373',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86022975'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402373'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378420',
  '2025-10-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22021986095'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378420'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '342214',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '342214'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410247',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'fin le 22/12/2025',
  'Tracking: U84300002104'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410247'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401816',
  '2025-11-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36183637597'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401816'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '347388',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '347388'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '415794',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'début le 23/12/2025',
  'Tracking: 88704543'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '415794'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405440',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22126004557'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405440'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372502',
  '2025-10-15'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82380144'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372502'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '361404',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '361404'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416557',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002295'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416557'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405906',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008723'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405906'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373106',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82408838'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373106'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359521',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359521'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404915',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008724'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404915'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '355825',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82416850'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '355825'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358177',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358177'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '416820',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 88723012'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '416820'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375143',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82417372'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375143'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349475',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349475'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '417146',
  '2025-12-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 88728192'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '417146'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405672',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22127617145'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405672'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378028',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Fin 16/10/2025',
  'Tracking: 82421357'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378028'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343835',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343835'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '410215',
  '2025-12-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U84300002313'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '410215'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '404405',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'fin le 28/11/2025',
  'Tracking: 9L36179681993'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '404405'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376255',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Par Quentin. Début 17/102025',
  'Tracking: 82441904'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376255'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340822',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340822'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '407751',
  '2025-12-23'::date,
  'cloturee'::claim_status,
  'fin le 23/12/2025',
  'Tracking: U84300002328'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '407751'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403037',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'début le 02/12',
  'Tracking: 9L36185764598'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403037'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359936',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 82442065'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359936'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349574',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349574'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399042',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008810'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399042'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373169',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000006574'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373169'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345429',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345429'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392314',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86151902'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392314'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379279',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61000006575'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379279'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '351982',
  '2025-09-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '351982'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '398140',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36179742373'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '398140'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378770',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 82442880'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378770'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '396684',
  '2025-11-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008811'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '396684'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378587',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 82442848'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378587'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '321684',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '321684'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '392397',
  '2025-11-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86220486'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '392397'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370949',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006576'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370949'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395803',
  '2025-11-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008812'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395803'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379098',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82455835'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379098'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350312',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350312'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '406073',
  '2025-11-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36178793574'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '406073'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379502',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82456260'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379502'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359745',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359745'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '402762',
  '2025-11-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6H14129243620'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '402762'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360217',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36058674672'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360217'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358651',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358651'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397529',
  '2025-11-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86262489'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397529'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371060',
  '2025-10-16'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36064673744'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371060'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '354553',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '354553'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '397057',
  '2025-11-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36183799486'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '397057'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375480',
  '2025-10-17'::date,
  'cloturee'::claim_status,
  'fin 17/102025',
  'Tracking: 82491704'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375480'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '333559',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '333559'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '399138',
  '2025-11-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36183802315'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '399138'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '362746',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '362746'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '401474',
  '2025-11-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86323708'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '401474'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '343207',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '343207'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '405375',
  '2025-11-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86324393'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '405375'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379995',
  '2025-10-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006618'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379995'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '334896',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '334896'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403226',
  '2025-11-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36183841239'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403226'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '377179',
  '2025-10-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006529'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '377179'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358886',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358886'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '395338',
  '2025-11-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008813'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '395338'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371572',
  '2025-10-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22022093334'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371572'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '354703',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '354703'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403986',
  '2025-11-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 86326302'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403986'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379494',
  '2025-10-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82538949'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379494'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358108',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358108'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '403561',
  '2025-11-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36178853520'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '403561'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375714',
  '2025-10-17'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22021293421'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375714'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353154',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353154'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '393389',
  '2025-11-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000008814 fin'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '393389'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380251',
  '2025-10-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006619'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380251'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '330479',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '330479'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371440',
  '2025-10-18'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36061733441'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371440'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337835',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337835'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378016',
  '2025-10-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006620'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378016'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339027',
  '2025-09-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339027'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375620',
  '2025-10-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006621'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375620'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360490',
  '2025-09-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360490'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380622',
  '2025-10-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82604217'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380622'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358898',
  '2025-09-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358898'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '341678',
  '2025-09-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '341678'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356653',
  '2025-09-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356653'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374838',
  '2025-10-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82608690'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374838'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337497',
  '2025-09-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337497'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '381448',
  '2025-10-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006623'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '381448'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '345257',
  '2025-09-20'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '345257'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372054',
  '2025-10-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006624'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372054'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '349465',
  '2025-09-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '349465'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379548',
  '2025-10-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006625'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379548'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375523',
  '2025-10-19'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82628678'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375523'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '354263',
  '2025-09-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '354263'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '366829',
  '2025-10-20'::date,
  'cloturee'::claim_status,
  'Par Quentin. Fin le 20/10/2025',
  'Tracking: 82677050'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '366829'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378167',
  '2025-10-20'::date,
  'cloturee'::claim_status,
  'début 21/10/2025',
  'Tracking: 82702106'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378167'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356905',
  '2025-09-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356905'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '377652',
  '2025-10-20'::date,
  'cloturee'::claim_status,
  'Par Quentin. Commande restée bloquée dans "commandes importées" dans sendcloud',
  'Tracking: 6M22020239444'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '377652'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '340833',
  '2025-09-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '340833'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '381470',
  '2025-10-21'::date,
  'cloturee'::claim_status,
  'Par Quentin. fin le 21/10/2025',
  'Tracking: U61000006714'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '381470'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '357173',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '357173'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372723',
  '2025-10-21'::date,
  'cloturee'::claim_status,
  'Début 22/10/2025',
  'Tracking: U61000006767'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372723'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '365032',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '365032'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378724',
  '2025-10-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36061857062'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378724'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '337149',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '337149'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '381241',
  '2025-10-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36063857077'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '381241'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '362467',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '362467'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372636',
  '2025-10-21'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36066856657'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372636'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '363977',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '363977'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380351',
  '2025-10-21'::date,
  'cloturee'::claim_status,
  'fin le 22/10/2025',
  'Tracking: 82798159'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380351'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360331',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360331'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380257',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Début le 23/10/2025',
  'Tracking: FR	
82842460'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380257'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359596',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359596'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379195',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 379195'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379195'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '355157',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '355157'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371683',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82844726'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371683'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359086',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359086'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '367100',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82847296'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '367100'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376472',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82848840'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376472'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '355272',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '355272'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371435',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Par Quentin. Commande qui n''a encore jamais été expédié : elle est dans sendcloud dans "commandes importées"',
  'Tracking: U61000006857'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371435'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '378189',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006841'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '378189'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350293',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350293'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372391',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82882155'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372391'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353134',
  '2025-09-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353134'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '367649',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006842'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '367649'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360290',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360290'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380293',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82890105'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380293'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '357457',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '357457'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380550',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22028588889'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380550'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356612',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356612'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380563',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82891337'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380563'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350217',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350217'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380315',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82891712'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380315'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '353844',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '353844'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '377664',
  '2025-10-22'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006843'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '377664'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '362587',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '362587'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382354',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82919314'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382354'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '363304',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '363304'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '377265',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006844'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '377265'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360176',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360176'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379330',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'étiquette recréée par Quentin car case "nouvel envoie" non cochée : Même en recréant l''étiquette, la partie "historique" ne se met pas... Audrey, peux-tu checker avant envoi, que ça apparait bien stp ? Historique apparaît bien',
  'Tracking: U61000006845'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379330'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360225',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360225'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375954',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36076640550'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375954'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '355610',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '355610'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382692',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 82928797'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382692'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338958',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338958'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382914',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001186'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382914'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '363747',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '363747'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373027',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61100001187'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373027'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '351257',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '351257'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382734',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'fin le 23/10/2025',
  'Tracking: 6M22026624688'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382734'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364243',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364243'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358399',
  '2025-09-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358399'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373066',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36072676492'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373066'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '357064',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '357064'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370113',
  '2025-10-23'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006868'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370113'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '350226',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '350226'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '383500',
  '2025-10-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006869'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '383500'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '363687',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '363687'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380325',
  '2025-10-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22029450574'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380325'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356459',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356459'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360378',
  '2025-10-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83001063'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360378'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '362069',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '362069'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382193',
  '2025-10-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36078688932'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382193'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '336101',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '336101'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '383768',
  '2025-10-24'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: U61100001188'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '383768'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '357323',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '357323'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360236',
  '2025-10-24'::date,
  'cloturee'::claim_status,
  'Par Quentin',
  'Tracking: 83010611'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360236'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '338770',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '338770'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359844',
  '2025-10-24'::date,
  'cloturee'::claim_status,
  'Par Quentin. Quentin : J''ai dupliqué cette commande en cochant "créer un nouvel envoi" mais pour l''instant je ne vois pas la partie "historique", à confirmer svp',
  'Tracking: 83011137'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359844'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '360173',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '360173'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380446',
  '2025-10-24'::date,
  'cloturee'::claim_status,
  'Début le 28/10/2025',
  'Tracking: 83033566'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380446'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '322992',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '322992'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '375359',
  '2025-10-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36077720923'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '375359'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '366251',
  '2025-09-24'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '366251'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380737',
  '2025-10-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006948'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380737'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '355203',
  '2025-09-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '355203'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '384602',
  '2025-10-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83107478'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '384602'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339742',
  '2025-09-25'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339742'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '383802',
  '2025-10-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83107561'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '383802'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380849',
  '2025-10-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83109611'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380849'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '335089',
  '2025-09-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '335089'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382591',
  '2025-10-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83109999'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382591'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359126',
  '2025-09-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359126'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373044',
  '2025-10-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006949'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373044'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364781',
  '2025-09-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364781'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '381477',
  '2025-10-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36072737254'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '381477'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '339158',
  '2025-09-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '339158'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376797',
  '2025-10-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36069738158'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376797'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '371298',
  '2025-10-26'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000006951'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '371298'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359656',
  '2025-09-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359656'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '376351',
  '2025-10-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83169378'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '376351'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380179',
  '2025-10-27'::date,
  'cloturee'::claim_status,
  'Par Quentin. Quentin : J''ai dupliqué cette commande en cochant "créer un nouvel envoi" mais pour l''instant je ne vois pas la partie "historique", à confirmer svp',
  'Tracking: LD226875846FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380179'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '368005',
  '2025-09-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '368005'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382049',
  '2025-10-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83224322'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382049'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '367782',
  '2025-09-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '367782'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '384548',
  '2025-10-27'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007038'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '384548'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364181',
  '2025-09-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364181'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '372537',
  '2025-10-28'::date,
  'cloturee'::claim_status,
  'fin le 28/10/2025',
  'Tracking: LD226982540FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '372537'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '344431',
  '2025-09-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '344431'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '385439',
  '2025-10-28'::date,
  'cloturee'::claim_status,
  'Par Quentin. Début 29/10/2025',
  'Tracking: 83301942'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '385439'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358365',
  '2025-09-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358365'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '374454',
  '2025-10-28'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007070'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '374454'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387055',
  '2025-10-29'::date,
  'cloturee'::claim_status,
  'Début le 30/10/2025',
  'Tracking: 6M22029683354'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387055'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '359744',
  '2025-09-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '359744'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380773',
  '2025-10-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36074896898'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380773'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386885',
  '2025-10-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83394999'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386885'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '358098',
  '2025-09-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '358098'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379144',
  '2025-10-29'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007100'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379144'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '356181',
  '2025-09-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '356181'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '373812',
  '2025-10-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83444619'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '373812'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '361950',
  '2025-09-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '361950'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382863',
  '2025-10-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83448100'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382863'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387801',
  '2025-10-30'::date,
  'cloturee'::claim_status,
  'FIN LE 30/10/2025',
  'Tracking: U61000007104'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387801'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '364846',
  '2025-09-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '364846'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386187',
  '2025-10-30'::date,
  'cloturee'::claim_status,
  'Départ le 31/10/2025',
  'Tracking: 83483328'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386187'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '383077',
  '2025-10-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007223'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '383077'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '368277',
  '2025-09-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '368277'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '379689',
  '2025-10-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 6M22038079629'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '379689'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '367912',
  '2025-09-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '367912'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '367479',
  '2025-09-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '367479'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386036',
  '2025-10-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007224'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386036'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '370042',
  '2025-09-30'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '370042'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386099',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 9L36093133639'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386099'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380517',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61100001286'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380517'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380419',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83541022'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380419'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '383761',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Fin le 31/10/2025',
  'Tracking: LD227317910FR'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '383761'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '380274',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Début le 03/11/2025',
  'Tracking: 9L36104139216'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '380274'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386694',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007261'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386694'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '387328',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83557321'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '387328'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '386161',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: U61000007266'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '386161'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '385510',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83578995'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '385510'
);

INSERT INTO claims (tenant_id, order_ref, opened_at, status, description, decision_note)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '382348',
  '2025-10-31'::date,
  'cloturee'::claim_status,
  'Réexpédition',
  'Tracking: 83579067'
WHERE NOT EXISTS (
  SELECT 1 FROM claims
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND order_ref = '382348'
);