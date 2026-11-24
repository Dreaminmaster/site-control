-- Bounded counters for authenticated principals (not a replacement for edge WAF).
CREATE TABLE IF NOT EXISTS rate_limits (
  principal TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL CHECK(hits>0)
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS login_flows_expiry ON login_flows(expires_at);
CREATE INDEX IF NOT EXISTS consent_flows_expiry ON consent_flows(expires_at);
-- Fail closed if application code attempts to bypass the state machine.
CREATE TRIGGER IF NOT EXISTS enforce_proposal_transition
BEFORE UPDATE OF status ON proposals
WHEN OLD.status <> NEW.status
BEGIN
 SELECT CASE WHEN NOT (
   (OLD.status='pending' AND NEW.status IN ('approved','rejected'))
   OR (OLD.status='approved' AND NEW.status IN ('applied','failed'))
 ) THEN RAISE(ABORT,'invalid_proposal_transition') END;
 SELECT CASE WHEN NEW.status IN ('approved','applied') AND NOT EXISTS(
   SELECT 1 FROM sites WHERE id=NEW.site_id AND revision=NEW.expected_revision AND revoked=0
 ) THEN RAISE(ABORT,'proposal_revision_or_revocation_conflict') END;
END;
