
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_flows (hash TEXT PRIMARY KEY, return_path TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS consent_flows (hash TEXT PRIMARY KEY, session_hash TEXT NOT NULL, request_json TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, label TEXT NOT NULL, sites TEXT NOT NULL, writable_sites TEXT NOT NULL DEFAULT '[]', can_propose INTEGER NOT NULL CHECK(can_propose IN(0,1)), expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT -1, config TEXT, last_seen INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), actor TEXT NOT NULL, reason TEXT NOT NULL, expected_revision INTEGER NOT NULL, before_config TEXT NOT NULL, config TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN('pending','approved','applied','failed','rejected')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_approved_per_site ON proposals(site_id) WHERE status='approved';
CREATE INDEX IF NOT EXISTS proposals_site_time ON proposals(site_id,created_at DESC);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT, action TEXT NOT NULL, subject TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS proposal_created AFTER INSERT ON proposals BEGIN
 INSERT INTO audit(site_id,action,subject,at) VALUES(NEW.site_id,'proposal:pending',NEW.id,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS proposal_status AFTER UPDATE OF status ON proposals WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO audit(site_id,action,subject,at) VALUES(NEW.site_id,'proposal:'||NEW.status,NEW.id,NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS proposal_applied AFTER UPDATE OF status ON proposals WHEN OLD.status='approved' AND NEW.status='applied' BEGIN
 UPDATE sites SET revision=NEW.expected_revision+1,config=NEW.config,last_seen=NEW.updated_at WHERE id=NEW.site_id AND revision=NEW.expected_revision;
END;
CREATE TRIGGER IF NOT EXISTS site_added AFTER INSERT ON sites BEGIN
 INSERT INTO audit(site_id,action,subject,at) VALUES(NEW.id,'site:registered',NEW.id,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS site_credential AFTER UPDATE OF token_hash,revoked ON sites BEGIN
 INSERT INTO audit(site_id,action,subject,at) VALUES(NEW.id,'site:credential_changed',NEW.id,unixepoch()*1000);
END;
CREATE TRIGGER IF NOT EXISTS agent_added AFTER INSERT ON agents BEGIN
 INSERT INTO audit(action,subject,at) VALUES('agent:authorized',NEW.id,unixepoch()*1000);
END;
CREATE TRIGGER IF NOT EXISTS agent_updated AFTER UPDATE OF sites,writable_sites ON agents WHEN OLD.sites<>NEW.sites OR OLD.writable_sites<>NEW.writable_sites BEGIN
 INSERT INTO audit(action,subject,at) VALUES('agent:sites_updated',NEW.id,unixepoch()*1000);
END;
CREATE TRIGGER IF NOT EXISTS agent_revoked AFTER UPDATE OF revoked ON agents WHEN OLD.revoked<>NEW.revoked BEGIN
 INSERT INTO audit(action,subject,at) VALUES('agent:revoked',NEW.id,unixepoch()*1000);
END;
