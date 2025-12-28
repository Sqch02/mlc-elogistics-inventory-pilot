-- Migration: Create sync_runs table
-- Description: Sync job tracking and logging

-- Sync status enum
CREATE TYPE sync_status AS ENUM ('running', 'success', 'partial', 'failed');

CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'sendcloud',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    status sync_status NOT NULL DEFAULT 'running',
    stats_json JSONB,
    error_text TEXT,
    cursor TEXT -- For pagination/incremental sync
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_tenant ON sync_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source ON sync_runs(tenant_id, source);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(tenant_id, status);

COMMENT ON TABLE sync_runs IS 'Sync job execution history and logs';
COMMENT ON COLUMN sync_runs.source IS 'Data source (e.g., sendcloud)';
COMMENT ON COLUMN sync_runs.stats_json IS 'Sync statistics (items processed, created, updated, etc.)';
COMMENT ON COLUMN sync_runs.cursor IS 'Pagination cursor or last sync date for incremental sync';

-- Function to get last successful sync cursor for a tenant/source
CREATE OR REPLACE FUNCTION get_last_sync_cursor(
    p_tenant_id UUID,
    p_source TEXT DEFAULT 'sendcloud'
) RETURNS TEXT AS $$
DECLARE
    v_cursor TEXT;
BEGIN
    SELECT cursor INTO v_cursor
    FROM sync_runs
    WHERE tenant_id = p_tenant_id
      AND source = p_source
      AND status IN ('success', 'partial')
      AND cursor IS NOT NULL
    ORDER BY ended_at DESC NULLS LAST
    LIMIT 1;

    RETURN v_cursor;
END;
$$ LANGUAGE plpgsql STABLE;
