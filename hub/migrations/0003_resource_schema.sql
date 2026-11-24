-- Immutable owner-selected collection schema. Old sites remain compatible with the base configuration.
ALTER TABLE sites ADD COLUMN resource_schema TEXT NOT NULL DEFAULT '[]';
CREATE TRIGGER IF NOT EXISTS immutable_resource_schema BEFORE UPDATE OF resource_schema ON sites WHEN OLD.resource_schema<>NEW.resource_schema BEGIN SELECT RAISE(ABORT,'resource_schema_immutable'); END;
