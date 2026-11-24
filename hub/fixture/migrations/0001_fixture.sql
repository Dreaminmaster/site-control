CREATE TABLE IF NOT EXISTS fixture_config(site_id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision>=0), config TEXT NOT NULL, last_job TEXT);
INSERT OR IGNORE INTO fixture_config(site_id,revision,config,last_job) VALUES('test-site',0,'{"title":"Site Control fixture","notice":"Only synthetic data","maintenance":false}',NULL);
