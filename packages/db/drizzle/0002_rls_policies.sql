-- Row-Level Security on tenant-scoped tables.
-- Each policy restricts rows to current_setting('app.current_org_id')::uuid,
-- which the API middleware sets via SET LOCAL at the start of each request.
-- Postgres superuser (`postgres`) bypasses RLS; we create `axon_app` for the
-- runtime API/worker role so RLS actually applies to their queries.

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_org_isolation ON documents
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY chunks_org_isolation ON chunks
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY jobs_org_isolation ON jobs
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_org_isolation ON conversations
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_keys_org_isolation ON api_keys
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_org_isolation ON usage
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- Dedicated application role used at runtime by API + workers. RLS applies
-- to it (not to superuser `postgres`). Dev can also connect as postgres for
-- migrations/admin and will bypass RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axon_app') THEN
    CREATE ROLE axon_app NOINHERIT LOGIN PASSWORD 'axon_app';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO axon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO axon_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO axon_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO axon_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO axon_app;
