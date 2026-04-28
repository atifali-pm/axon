-- RLS for agent_templates + message_feedback.
--
-- These tables were added in 0004/0005 but the RLS policy set in 0002 was
-- never extended to cover them, so the axon_app role saw rows from every
-- tenant. Same pattern as 0002: gate USING + WITH CHECK on the transactional
-- GUC `app.current_org_id`. The /api/agents/public endpoint reads via the
-- superuser pool with an explicit `is_public = true` filter, so listing
-- public templates across orgs still works after this lockdown.

ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_templates_org_isolation ON agent_templates
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_feedback_org_isolation ON message_feedback
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
